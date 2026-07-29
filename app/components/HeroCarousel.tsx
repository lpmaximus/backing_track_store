"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link } from "@/src/i18n/navigation";
import type { StaticPathname } from "@/src/i18n/routing";

/**
 * Carrossel do hero — padrão layout-6 (BRD-001).
 * Imagens em /public: carousel-1.jpg … carousel-5.jpg
 * (fallback: gradiente escuro enquanto a imagem não existir).
 */
const SLIDE_HREFS: StaticPathname[] = ["/upload", "/catalogo", "/como-funciona", "/bandas", "/entrar"];
const SLIDE_IMGS = ["/carousel-1.jpg", "/carousel-2.jpg", "/carousel-3.jpg", "/carousel-4.jpg", "/carousel-5.jpg"];

export default function HeroCarousel() {
  const t = useTranslations("carousel");
  const SLIDES = SLIDE_HREFS.map((href, i) => ({
    title: t(`s${i + 1}Title`),
    sub: t(`s${i + 1}Sub`),
    desc: t(`s${i + 1}Desc`),
    cta: t(`s${i + 1}Cta`),
    href,
    img: SLIDE_IMGS[i],
  }));
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
