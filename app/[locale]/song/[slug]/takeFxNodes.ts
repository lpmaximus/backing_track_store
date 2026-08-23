"use client";

/**
 * Construção dos nós de efeito das gravações, e a renderização deles em buffer.
 *
 * Mora fora do WavePlayer porque tem DOIS consumidores que precisam soar
 * igual: o player (tempo real) e o download (offline). Se cada um montasse a
 * própria cadeia, um ajuste feito num lado sairia diferente no outro — e o
 * jeito de descobrir seria o usuário baixar o arquivo e estranhar.
 *
 * O catálogo e a validação continuam em src/lib/takeFx.ts, que é puro e roda
 * também no servidor. Aqui é só a parte que depende do Tone.js.
 */

import { fxVazio, type TakeFx } from "@/src/lib/takeFx";

type ToneMod = typeof import("tone");
type Node = import("tone").ToneAudioNode;

/**
 * Monta a cadeia de um preset.
 *
 * Os valores são ajuste de ouvido, não escolha arbitrária:
 *  · hall/room — reverb; muda só o tempo de cauda. Sala curta tira o seco sem
 *    borrar a dicção; hall longo dá espaço a voz sustentada.
 *  · vocal — compressor suave com brilho leve. Nivela a diferença entre o
 *    verso sussurrado e o refrão gritado, que é o que faz voz caseira sumir
 *    debaixo da banda.
 *  · comp — compressão mais firme, para instrumento com ataque forte.
 *  · drive — distorção com corte de grave antes: distorcer região grave embola.
 *  · chorus / delay — modulação e repetição.
 *
 * `mix` é 0 (seco) a 1 (efeito cheio) em todos.
 */
export function montarFx(Tone: ToneMod, fx: TakeFx): Node[] {
  const m = Math.max(0, Math.min(1, fx.mix));

  switch (fx.preset) {
    /**
     * Voz de estúdio — a cadeia de acabamento inteira, na ordem em que um
     * engenheiro montaria. Não é "mais um efeito": é o tratamento que responde
     * por boa parte da distância entre gravação caseira e voz produzida.
     *
     * 1. Corte grave em 85 Hz — tira ronco de sala, ar-condicionado e o estouro
     *    do "p" batendo no microfone. Nada de útil na voz mora abaixo disso, e
     *    o que sobra ali só consome espaço na mixagem.
     * 2. Compressor — nivela verso sussurrado e refrão gritado. É o passo que
     *    faz a voz parar de afundar debaixo da banda nos trechos baixos.
     * 3. De-esser (compressor multibanda com a banda alta apertada) — o passo
     *    2 sobe tudo, inclusive o "s" e o "ch", que viram chiado agressivo.
     *    Este desfaz esse efeito colateral, e por isso vem DEPOIS.
     * 4. Presença — brilho na região que dá inteligibilidade, com uma leve
     *    limpeza de grave para a voz não soar embolada.
     * 5. Ambiente curto — voz totalmente seca soa colada no rosto do ouvinte.
     *    Pouca cauda basta para colocá-la no mesmo espaço da banda.
     * 6. Limitador — teto de segurança. A cadeia toda soma ganho; sem isto o
     *    pico corta na hora do download e distorce sem aviso.
     *
     * `mix` é a intensidade do tratamento, não de um efeito: em 0 a cadeia
     * quase não atua; em 1 comprime firme, tira mais sibilância e abre mais
     * presença.
     */
    case "studio":
      return [
        new Tone.Filter({ type: "highpass", frequency: 85 }),
        new Tone.Compressor({
          threshold: -12 - m * 12,
          ratio: 2 + m * 2,
          attack: 0.006,
          release: 0.15,
        }),
        new Tone.MultibandCompressor({
          lowFrequency: 250,
          highFrequency: 5500,
          low: { threshold: -24, ratio: 2 },
          mid: { threshold: -24, ratio: 2 },
          high: { threshold: -30, ratio: 4 + m * 4 },
        }),
        new Tone.EQ3({ low: -1.5, mid: 0.5, high: 2 * m }),
        new Tone.Reverb({ decay: 1.0, preDelay: 0.01, wet: m * 0.18 }),
        new Tone.Limiter(-1),
      ];
    case "hall":
      return [new Tone.Reverb({ decay: 2.8, preDelay: 0.02, wet: m })];
    case "room":
      return [new Tone.Reverb({ decay: 0.9, preDelay: 0.008, wet: m * 0.8 })];
    case "vocal":
      return [
        new Tone.Compressor({ threshold: -20, ratio: 3, attack: 0.005, release: 0.12 }),
        new Tone.EQ3({ low: -1, mid: 0, high: 1.5 * m }),
        new Tone.Reverb({ decay: 1.2, wet: m * 0.25 }),
      ];
    case "comp":
      return [new Tone.Compressor({ threshold: -24, ratio: 4, attack: 0.003, release: 0.1 })];
    case "drive":
      return [
        new Tone.Filter({ type: "highpass", frequency: 90 }),
        new Tone.Distortion({ distortion: 0.15 + m * 0.5, wet: 1 }),
        new Tone.EQ3({ low: -2, mid: 1, high: -1 }),
      ];
    case "chorus":
      return [new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: m }).start()];
    case "delay":
      return [new Tone.FeedbackDelay({ delayTime: 0.25, feedback: 0.25, wet: m })];
    default:
      return [];
  }
}

/**
 * O reverb do Tone gera a resposta ao impulso de forma assíncrona. Renderizar
 * antes disso devolve silêncio no lugar da cauda — o arquivo sairia seco e sem
 * erro nenhum aparecendo.
 */
async function esperarProntos(Tone: ToneMod, cadeia: Node[]): Promise<void> {
  await Promise.all(
    cadeia.map(n => (n instanceof Tone.Reverb ? n.generate().then(() => undefined) : Promise.resolve())),
  );
}

/**
 * Renderiza a gravação COM efeito num buffer, já posicionada na linha do tempo
 * da música.
 *
 * É o que faz o arquivo baixado soar como o que se ouve no player. Sem isto o
 * download sairia seco — a mesma armadilha do offset: soa certo na tela e sai
 * diferente no arquivo, e a pessoa só descobre depois de mandar para a banda.
 *
 * O deslocamento segue a convenção do módulo inteiro:
 *   posição de leitura da faixa = posição da música + offset
 */
export async function renderTakeComFx(
  buffer: AudioBuffer,
  fx: TakeFx | null | undefined,
  offsetSec: number,
  songDuration: number,
): Promise<AudioBuffer> {
  const Tone = await import("tone");

  const rendered = await Tone.Offline(async () => {
    const player = new Tone.Player(buffer);
    const cadeia = fxVazio(fx) ? [] : montarFx(Tone, fx!);

    if (cadeia.length === 0) {
      player.toDestination();
    } else {
      player.connect(cadeia[0]);
      for (let i = 0; i < cadeia.length - 1; i++) cadeia[i].connect(cadeia[i + 1]);
      cadeia[cadeia.length - 1].toDestination();
      await esperarProntos(Tone, cadeia);
    }

    // Não dá para ler tempo negativo: offset negativo vira entrada mais tarde,
    // que é o mesmo efeito no ouvido. Igual ao `startAll` do player.
    if (offsetSec >= 0) {
      if (offsetSec < buffer.duration) player.start(0, offsetSec);
    } else {
      player.start(-offsetSec, 0);
    }
  }, songDuration, 2);

  return rendered.get() as AudioBuffer;
}
