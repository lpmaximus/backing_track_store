"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Carrossel do hero — padrão layout-6 (BRD-001).
 * Imagens em /public: carousel-1.jpg … carousel-5.jpg
 * (fallback: gradiente escuro enquanto a imagem não existir).
 */
const SLIDES = [
  {
    title: "Separação de stems",
    sub: "Separe qualquer faixa",
    desc: "Transforme sua música em questão de segundos. Isole ou silencie vocais e instrumentos com a maior fidelidade possível.",
    cta: "Isolar faixas",
    href: "/upload",
    img: "/carousel-1.jpg",
  },
  {
    title: "Mixer por instrumento",
    sub: "Sua mix, do seu jeito",
    desc: "Volume, mute e solo em cada stem. Silencie o seu instrumento e assuma o lugar dele na banda.",
    cta: "Testar o mixer",
    href: "/#catalogo",
    img: "/carousel-2.jpg",
  },
  {
    title: "Cifra sincronizada",
    sub: "Toque junto, sem errar",
    desc: "Cifras interativas rolando em sincronia com o áudio, com controle de velocidade e tom.",
    cta: "Ver como funciona",
    href: "/como-funciona",
    img: "/carousel-3.jpg",
  },
  {
    title: "Feito para bandas",
    sub: "Uma mix para cada integrante",
    desc: "Convide sua banda, compartilhe setlists e cada um ouve a música sem o próprio instrumento.",
    cta: "Criar minha banda",
    href: "/bandas",
    img: "/carousel-4.jpg",
  },
  {
    title: "Do ensaio ao palco",
    sub: "Pronto para tocar ao vivo",
    desc: "Monte setlists para o show e leve suas backing tracks para qualquer palco.",
    cta: "Começar grátis",
    href: "/entrar",
    img: "/carousel-5.jpg",
  },
];

export default function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function goTo(i: number) {
    if (i === index) return;
    setVisible(false);
    setTimeout(() => {
      setIndex(i);
      setVisible(true);
    }, 300);
  }

  function restart() {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(prev => (prev + 1) % SLIDES.length);
        setVisible(true);
      }, 300);
    }, 5000);
  }

  useEffect(() => {
    restart();
    return () => { if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slide = SLIDES[index];

  return (
    <div className="caro">
      <div className="caro-txt">
        <div className={`caro-fade${visible ? "" : " hide"}`}>
          <h3>{slide.title}</h3>
          <div className="caro-sub">{slide.sub}</div>
          <p>{slide.desc}</p>
          <Link href={slide.href} className="caro-cta">{slide.cta}</Link>
        </div>
        <div className="caro-dots">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              aria-label={`Slide ${i + 1}`}
              className={i === index ? "on" : ""}
              onClick={() => { goTo(i); restart(); }}
            />
          ))}
        </div>
      </div>
      <div className="caro-img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={`caro-fade${visible ? "" : " hide"}`}
          src={slide.img}
          alt={slide.title}
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          onLoad={e => { (e.target as HTMLImageElement).style.display = ""; }}
        />
      </div>
    </div>
  );
}
