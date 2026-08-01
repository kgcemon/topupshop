"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Slide = { id: number; image: string; link?: string | null };

export function Carousel({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (!slides.length) return null;

  return (
    <div className="container mx-auto mt-4 px-3 md:px-4">
      <div className="relative w-full overflow-hidden rounded-lg">
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {slides.map((slide) => (
              <div
                key={slide.id}
                className="relative aspect-[21/9] w-full shrink-0 md:aspect-auto md:h-[340px]"
              >
                <Image
                  src={slide.image}
                  alt="Banner"
                  fill
                  sizes="(min-width: 768px) 1200px, 100vw"
                  priority={slide.id === slides[0].id}
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </div>

        {slides.length > 1 && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                aria-label={`Slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1 w-5 rounded-sm transition-colors ${
                  i === index ? "bg-gray-800" : "bg-gray-400/60"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
