"""
Cog predictor do BTC (Bi-directional Transformer for Chord Recognition).

Empacota o repo de referência jayg996/BTC-ISMIR19 como um modelo Replicate que
recebe um áudio (o stem de HARMONIA que o backingtrack já isola) e devolve os
acordes com timestamp — no formato que src/lib/chords/btc.ts sabe ler:

    [ { "start": <segundos>, "end": <segundos>, "chord": "C:maj" }, ... ]

O fluxo de inferência abaixo espelha o test.py do repo original (janela
deslizante sobre as features de CQT + decodificação idx->acorde). Ver README.md
para o passo a passo de deploy (clonar o repo, baixar os pesos, cog push).

⚠️ Confirme no 1º teste real (README, seção "Validar"):
   - o nome do arquivo de pesos (btc_model_large_voca.pt vs btc_model.pt);
   - a normalização mean/std (use a do config do repo p/ máxima acurácia).
"""
import os
import sys
import json
from typing import Any

from cog import BasePredictor, Input, Path

# O repo BTC-ISMIR19 é clonado para ./BTC-ISMIR19 no build (ver cog.yaml/README).
BTC_DIR = os.path.join(os.path.dirname(__file__), "BTC-ISMIR19")
sys.path.insert(0, BTC_DIR)

import numpy as np  # noqa: E402
import torch  # noqa: E402
import librosa  # noqa: E402

# Krumhansl-Kessler: perfis de tonalidade p/ estimar o tom a partir do chroma.
_KS_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_KS_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def estimate_key(chroma_mean: np.ndarray) -> str:
    """Estima o tom (ex.: 'C', 'Am') correlacionando o chroma médio com os perfis KS."""
    best_score, best_key = -2.0, "C"
    for tonic in range(12):
        for profile, suffix in ((_KS_MAJOR, ""), (_KS_MINOR, "m")):
            rolled = np.roll(profile, tonic)
            score = float(np.corrcoef(rolled, chroma_mean)[0, 1])
            if score > best_score:
                best_score, best_key = score, _NOTE_NAMES[tonic] + suffix
    return best_key

# Módulos do repo BTC.
from btc_model import BTC_model  # noqa: E402
from utils.hparams import HParams  # noqa: E402
from utils import logger  # noqa: E402
from utils.mir_eval_modules import audio_file_to_features, idx2chord, idx2voca_chord  # noqa: E402

logger.logging_verbosity(0)


class Predictor(BasePredictor):
    def setup(self):
        """Carrega config, pesos e vocabulário uma vez (mantém o modelo quente)."""
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.config = HParams.load(os.path.join(BTC_DIR, "run_config.yaml"))

        # Modelo de vocabulário grande (170 acordes: 7ª, dim, sus, etc.). Se preferir
        # só maior/menor, troque para o btc_model.pt + idx2chord e voca=False.
        self.voca = True
        if self.voca:
            self.config.feature["large_voca"] = True
            self.config.model["num_chords"] = 170
            weights = os.path.join(BTC_DIR, "test", "btc_model_large_voca.pt")
            self.idx_to_chord = idx2voca_chord()
        else:
            weights = os.path.join(BTC_DIR, "test", "btc_model.pt")
            # idx2chord é uma LISTA (não função) no repo — sem parênteses.
            self.idx_to_chord = idx2chord

        self.model = BTC_model(config=self.config.model).to(self.device)
        checkpoint = torch.load(weights, map_location=self.device)
        # Normalização usada no treino (vem no checkpoint do repo).
        self.mean = checkpoint.get("mean", 0.0)
        self.std = checkpoint.get("std", 1.0)
        self.model.load_state_dict(checkpoint["model"])
        self.model.eval()

    @torch.no_grad()
    def predict(
        self,
        audio: Path = Input(description="Áudio (stem de harmonia de preferência)"),
    ) -> Any:
        """Detecta acordes e devolve a lista [{start,end,chord}]."""
        feature, feature_per_second, _ = audio_file_to_features(str(audio), self.config)
        feature = feature.T
        feature = (feature - self.mean) / self.std

        n_timestep = self.config.model["timestep"]
        num_pad = n_timestep - (feature.shape[0] % n_timestep)
        feature = np.pad(feature, ((0, num_pad), (0, 0)), mode="constant", constant_values=0)
        num_instance = feature.shape[0] // n_timestep

        time_unit = feature_per_second  # segundos por frame
        feat = torch.tensor(feature, dtype=torch.float32).unsqueeze(0).to(self.device)

        results = []
        start_time = 0.0
        prev_chord = None
        for t in range(num_instance):
            encoded, _ = self.model.self_attn_layers(feat[:, n_timestep * t:n_timestep * (t + 1), :])
            prediction, _ = self.model.output_layer(encoded)
            prediction = prediction.squeeze()
            for i in range(n_timestep):
                frame = n_timestep * t + i
                idx = int(prediction[i].item())
                if prev_chord is None:
                    prev_chord = idx
                    continue
                if idx != prev_chord:
                    results.append({
                        "start": round(start_time, 3),
                        "end": round(time_unit * frame, 3),
                        "chord": self.idx_to_chord[prev_chord],
                    })
                    start_time = time_unit * frame
                    prev_chord = idx
        # Fecha o último trecho.
        last_frame = num_instance * n_timestep - 1
        if prev_chord is not None and start_time != time_unit * last_frame:
            results.append({
                "start": round(start_time, 3),
                "end": round(time_unit * last_frame, 3),
                "chord": self.idx_to_chord[prev_chord],
            })

        # ── BPM, batidas e tom (mesma execução, custo ~zero) ──────────────────
        bpm = 0
        key = ""
        beats: list = []
        meta_error = ""
        try:
            # sr=None → sample rate NATIVO, sem reamostrar (evita a dependência
            # resampy/soxr, que não está na imagem). beat_track/chroma aceitam qualquer sr.
            y, sr = librosa.load(str(audio), sr=None, mono=True)
            tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
            bpm = int(round(float(np.atleast_1d(tempo)[0])))
            beats = [round(float(t), 3) for t in librosa.frames_to_time(beat_frames, sr=sr)]
            chroma = librosa.feature.chroma_cqt(y=y, sr=sr).mean(axis=1)
            key = estimate_key(chroma)
        except Exception as e:  # noqa: BLE001
            meta_error = str(e)
            print("análise bpm/key/beats falhou:", e)

        out = {"chords": results, "bpm": bpm, "key": key, "beats": beats}
        if meta_error:
            out["meta_error"] = meta_error[:300]  # visível no output p/ debug
        # Replicate serializa o retorno como JSON.
        return json.loads(json.dumps(out))
