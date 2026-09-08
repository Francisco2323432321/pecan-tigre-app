"use client";

import { useEffect, useState } from "react";

type Slide = { id: string; name: string; image_url: string };

export default function ProductCarousel({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % slides.length), 4500);
    return () => window.clearInterval(timer);
  }, [slides.length]);
  if (!slides.length) return <div className="flex h-full min-h-[190px] items-center justify-center rounded-[24px] bg-gradient-to-br from-[#f7f3ff] to-[#fff0f6] text-center text-sm font-bold text-[#8b778f]">Las fotos de tus productos aparecerán acá.</div>;
  const current = slides[index % slides.length];
  return <div className="relative min-h-[190px] overflow-hidden rounded-[24px] bg-[#f5eef4] sm:min-h-[220px]">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img key={current.id} src={current.image_url} alt={current.name} className="absolute inset-0 h-full w-full object-cover animate-[pt-fade_.35s_ease-out]" loading="lazy" />
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 pb-4 pt-12 text-white"><p className="truncate text-sm font-black">{current.name}</p><div className="mt-2 flex gap-1.5">{slides.map((slide, i) => <span key={slide.id} className={`h-1.5 rounded-full ${i === index ? "w-6 bg-white" : "w-1.5 bg-white/55"}`} />)}</div></div>
  </div>;
}
