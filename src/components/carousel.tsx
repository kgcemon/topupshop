"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

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
    <div className="container mx-auto my-3 md:my-5">
      <div className="relative w-full overflow-hidden rounded-lg">
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {slides.map((slide) => {
              const isFirst = slide.id === slides[0].id;
              const href = slide.link?.trim() || null;
              const image = (
                <Image
                  src={slide.image}
                  alt="Banner"
                  fill
                  sizes="(min-width: 768px) 1200px, 100vw"
                  // `priority` was deprecated in Next.js 16 in favor of `preload`
                  // — and unlike the old `priority` prop, neither `preload` nor
                  // `priority` auto-sets `fetchPriority` anymore, so it has to be
                  // passed explicitly for the LCP image to actually get
                  // fetchpriority="high" in the rendered HTML.
                  preload={isFirst}
                  fetchPriority={isFirst ? "high" : undefined}
                  className="object-cover"
                />
              );
              return (
                <div
                  key={slide.id}
                  className="relative aspect-[21/9] w-full shrink-0 md:aspect-auto md:h-[340px]"
                >
                  {href ? <SlideLink href={href}>{image}</SlideLink> : image}
                </div>
              );
            })}
          </div>
        </div>

        {slides.length > 1 && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                aria-label={`Slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1 w-3 transition-colors ${
                  i === index ? "bg-primary-500" : "bg-[#090f207f]"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// A banner's link is admin-typed, so it can be either an in-app path
// ("/topup/3/uid-topup") or a full external URL. Next's Link only handles the
// former; sending an external URL through it would try a client-side
// navigation to a route that doesn't exist.
function SlideLink({ href, children }: { href: string; children: React.ReactNode }) {
  const isInternal = href.startsWith("/");

  if (isInternal) {
    return (
      <Link href={href} className="absolute inset-0 block">
        {children}
      </Link>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="absolute inset-0 block">
      {children}
    </a>
  );
}
