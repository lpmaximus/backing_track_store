# BTC Chords — modelo Replicate (alternativa caseira ao Music.ai)

Empacota o [BTC-ISMIR19](https://github.com/jayg996/BTC-ISMIR19) (Bi-directional
Transformer for Chord Recognition) como modelo no Replicate. O app chama esse
modelo pelo `BTCChordProvider` (`src/lib/chords/btc.ts`) sobre o **stem de
harmonia** já isolado, por polling — mesmo padrão do Whisper de letra.

**Por que:** o módulo de acordes do Music.ai (mesma engine do Moises) custa
~US$ 0,04/min ≈ US$ 0,14/música. O BTC self-hosted custa só o compute
(~US$ 0,005/música) e fica na mesma faixa de acurácia em maior/menor
(~83–89% reportado), com a comunidade corrigindo o rascunho por cima.

## Deploy (uma vez)

Pré-requisitos: [Cog](https://github.com/replicate/cog) e uma conta Replicate.

```bash
cd replicate/btc-chords

# 1) Clona o repo de referência para dentro desta pasta (o predict.py o importa).
#    Os pesos JÁ VÊM no clone, em BTC-ISMIR19/test/ (btc_model.pt e
#    btc_model_large_voca.pt) — não precisa baixar nada à parte.
git clone https://github.com/jayg996/BTC-ISMIR19.git

# 1b) PATCH obrigatório (repo é de 2019, incompatível com PyYAML 6): em
#     BTC-ISMIR19/utils/hparams.py, a linha `yaml.load(f)` precisa virar
#     `yaml.load(f, Loader=yaml.FullLoader)`. Sem isso o setup() quebra com
#     "load() missing 1 required positional argument: 'Loader'".
sed -i 's/yaml.load(f)/yaml.load(f, Loader=yaml.FullLoader)/' BTC-ISMIR19/utils/hparams.py

# 2) Testa localmente (precisa de GPU p/ ser rápido, mas roda em CPU):
cog predict -i audio=@/caminho/para/stem_harmonia.wav

# 3) Publica no Replicate:
cog login
cog push r8.im/<seu-usuario>/btc-chords
```

O `cog push` imprime o **hash da versão**. Copie-o.

## Ligar no app

No `.env`/`.env.local` do backingtrack:

```
CHORDS_PROVIDER=btc
REPLICATE_BTC_VERSION=<hash-da-versao-do-cog-push>
# REPLICATE_API_TOKEN já existe (usado pela separação/letra)
```

Sem `CHORDS_PROVIDER=btc` o app continua no Music.ai — dá pra alternar os dois só
trocando essa variável, útil pra comparar lado a lado.

## Validar (importante no 1º teste real)

O `predict.py` espelha o `test.py` do repo, mas confirme dois pontos com um áudio
de verdade, porque afetam a acurácia:

1. **Nome do arquivo de pesos** — o repo distribui `btc_model_large_voca.pt`
   (vocabulário grande) e `btc_model.pt` (maior/menor). Ajuste em `setup()` se o
   nome vier diferente.
2. **Normalização mean/std** — o `predict.py` lê `mean`/`std` do checkpoint. Se o
   checkpoint do repo não trouxer esses campos, pegue os valores do config de
   treino do repo (ou normalize por música) — usar os errados degrada o acerto.

A saída esperada pelo `btc.ts` é uma lista JSON
`[{ "start", "end", "chord": "C:maj" }, ...]`; o parser do app já normaliza os
labels do BTC (`C:maj`→`C`, `A:min7`→`Am7`) e também aceita texto `.lab`.
