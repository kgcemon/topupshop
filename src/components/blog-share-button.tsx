"use client";

import { useEffect, useRef, useState } from "react";

export function BlogShareButton({ title, url }: { title: string; url: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleShareClick = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // user cancelled the native share sheet, do nothing
      }
      return;
    }
    setOpen((v) => !v);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable, ignore
    }
  };

  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(title);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={handleShareClick}
        className="flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-1.5 text-sm font-bold text-gray-500 transition-colors hover:border-primary-200 hover:text-primary-600"
      >
        <ShareIcon />
        শেয়ার
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg">
          <a
            href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <WhatsAppIcon />
            WhatsApp
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <FacebookIcon />
            Facebook
          </a>
          <a
            href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <TelegramIcon />
            Telegram
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <LinkIcon />
            {copied ? "লিংক কপি হয়েছে!" : "লিংক কপি করুন"}
          </button>
        </div>
      )}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
      <circle cx="18" cy="5" r="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18" cy="19" r="3" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.6 13.5 6.8 3.9M15.4 6.6 8.6 10.5" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#25D366" className="h-4 w-4 shrink-0">
      <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.48 1.34 5L2 22l5.2-1.36a9.94 9.94 0 0 0 4.84 1.23h.01c5.5 0 9.96-4.46 9.96-9.96S17.55 2 12.04 2Zm5.83 14.24c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.11.11-1.8-.11a16.6 16.6 0 0 1-1.62-.6c-2.86-1.24-4.72-4.12-4.86-4.31-.14-.19-1.17-1.55-1.17-2.96 0-1.41.74-2.1 1-2.39.26-.28.57-.35.76-.35.19 0 .38 0 .55.01.18.01.41-.07.64.49.24.57.81 1.98.88 2.12.07.14.12.31.02.5-.09.19-.14.31-.28.47-.14.16-.29.36-.42.48-.14.14-.28.29-.12.57.16.28.71 1.18 1.53 1.91 1.05.94 1.94 1.24 2.22 1.38.28.14.44.12.61-.07.16-.19.69-.8.87-1.08.19-.28.37-.23.62-.14.26.09 1.64.78 1.92.92.28.14.47.21.54.33.07.12.07.68-.17 1.36Z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1877F2" className="h-4 w-4 shrink-0">
      <path d="M24 12.07C24 5.7 18.63.55 12 .55S0 5.7 0 12.07c0 5.75 4.39 10.52 10.13 11.38v-8.05H7.08v-3.33h3.05V9.44c0-2.99 1.79-4.64 4.55-4.64 1.32 0 2.7.23 2.7.23v2.92h-1.52c-1.5 0-1.97.92-1.97 1.86v2.24h3.35l-.54 3.33h-2.81v8.05C19.61 22.59 24 17.82 24 12.07Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#26A5E4" className="h-4 w-4 shrink-0">
      <path d="M21.05 3.79 2.6 10.98c-1.24.5-1.23 1.2-.23 1.5l4.72 1.47 1.82 5.53c.22.6.37.84.75.84.38 0 .55-.17.75-.38l1.8-1.75 4.75 3.5c.87.48 1.5.23 1.72-.8L22 5.06c.3-1.26-.48-1.83-1.95-1.27Z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-gray-500">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12a4 4 0 0 0 5.66.24l3-3a4 4 0 0 0-5.66-5.66l-1.72 1.72" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a4 4 0 0 0-5.66-.24l-3 3a4 4 0 0 0 5.66 5.66l1.71-1.71" />
    </svg>
  );
}
