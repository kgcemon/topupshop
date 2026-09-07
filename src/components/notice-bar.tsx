"use client";

import { useEffect, useRef, useState } from "react";

export function NoticeBar({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);
  const [sliding, setSliding] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);

  // Only marquee when the message is actually wider than the space it has;
  // a short notice should sit still rather than scroll off and back.
  useEffect(() => {
    const track = trackRef.current;
    const slide = slideRef.current;
    if (!track || !slide) return;

    const measure = () => setSliding(slide.scrollWidth > track.clientWidth);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(track);
    observer.observe(slide);
    return () => observer.disconnect();
  }, [message]);

  if (!visible) return null;

  const text = (
    <span className="fb-normal font-primary text-[12px] font-medium leading-none text-gray-700 md:text-[13px]">
      {message}
    </span>
  );

  return (
    <section className="container mx-auto p-0 md:py-1">
      <div className="notice-bar group relative flex h-[38px] items-center overflow-hidden shadow-sm md:h-[46px]">
        <div className="notice-label relative z-10 flex h-full shrink-0 items-center gap-2 px-3 text-white md:px-4">
          <span className="relative flex h-2.5 w-2.5 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/75" />
            <span className="notice-dot relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] md:text-[12px]">
            Notice
          </span>
        </div>

        <div ref={trackRef} className="notice-track relative min-w-0 flex-1 overflow-hidden">
          <div
            ref={slideRef}
            className={`notice-slide whitespace-nowrap px-4 md:px-5 ${sliding ? "is-sliding inline-block" : "block truncate"}`}
          >
            {text}
          </div>
        </div>

        <button
          onClick={() => setVisible(false)}
          aria-label="বন্ধ করুন"
          className="notice-close group/close z-10 mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--notice-color)] bg-[var(--notice-color)] transition-all duration-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="h-3.5 w-3.5 text-white transition-all duration-200 group-hover/close:rotate-90"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </section>
  );
}
