"use client";

import { useState } from "react";
import Image from "next/image";
import { formatTaka } from "@/lib/utils";
import { youtubeVideoId } from "@/lib/bangla-qr";

const BKASH_PINK = "#E2136E";

/**
 * Shown instead of the bKash number when the amount is below the admin's
 * bKash minimum and the admin picked "Bangla QR" mode. Walks the customer
 * through paying the QR from the bKash app, then collects the bKash number
 * they paid from (name="payerNumber") — the server matches that, the amount
 * and the time against the bank's SMS.
 */
export function BanglaQrPanel({
  amount,
  qrImage,
  videoUrl,
  error,
}: {
  amount: number;
  qrImage: string;
  videoUrl: string | null;
  error?: string;
}) {
  const [showVideo, setShowVideo] = useState(false);
  const [payer, setPayer] = useState("");
  const videoId = youtubeVideoId(videoUrl);
  const digits = payer.replace(/\D/g, "");
  const payerLooksValid = /^01[3-9]\d{8}$/.test(digits);
  const amountText = amount > 0 ? `৳${formatTaka(amount)}` : "";

  return (
    <div className="overflow-hidden rounded-xl border-2" style={{ borderColor: BKASH_PINK }}>
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 text-white" style={{ backgroundColor: BKASH_PINK }}>
        <div className="flex items-center gap-2">
          <QrIcon className="h-5 w-5" />
          <span className="text-sm font-bold">বিকাশ দিয়ে Bangla QR পেমেন্ট</span>
        </div>
        {amountText && (
          <span className="rounded-full bg-white px-2.5 py-0.5 text-sm font-extrabold" style={{ color: BKASH_PINK }}>
            {amountText}
          </span>
        )}
      </div>

      <div className="space-y-4 bg-white p-3">
        {/* QR + download */}
        <div className="flex flex-col items-center gap-2 rounded-lg bg-pink-50 p-3">
          <Image
            src={qrImage}
            alt="Bangla QR কোড"
            width={220}
            height={220}
            unoptimized
            className="h-48 w-48 rounded-lg border border-pink-100 bg-white object-contain p-1.5 sm:h-52 sm:w-52"
          />
          <a
            href={qrImage}
            download="bangla-qr-payment.png"
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-white shadow-sm active:scale-[0.99]"
            style={{ backgroundColor: BKASH_PINK }}
          >
            <DownloadIcon className="h-4 w-4" />
            QR কোড ডাউনলোড করুন
          </a>
          <p className="text-center text-[11px] leading-snug text-gray-500">
            ডাউনলোড না হলে QR ছবির উপর আঙুল চেপে ধরে <span className="font-semibold">&quot;Save image / ছবি সেভ&quot;</span> করুন
          </p>
        </div>

        {/* Steps */}
        <div>
          <p className="mb-2 text-sm font-bold text-secondary-900">কিভাবে পেমেন্ট করবেন?</p>
          <ol className="space-y-2">
            <Step n={1}>উপরের বাটনে চাপ দিয়ে QR কোডটি ফোনে ডাউনলোড করুন।</Step>
            <Step n={2}>
              <span className="font-semibold">bKash অ্যাপ</span> খুলুন, তারপর <span className="font-semibold">&quot;পেমেন্ট&quot;</span>{" "}
              অপশনে চাপুন।
            </Step>
            <Step n={3}>
              স্ক্যানারের উপরে <span className="font-semibold">গ্যালারি / ছবি</span> আইকনে চাপ দিয়ে ডাউনলোড করা QR ছবিটি
              সিলেক্ট করুন।
            </Step>
            <Step n={4}>
              টাকার ঘরে ঠিক{" "}
              <span className="rounded bg-yellow-100 px-1 font-extrabold text-secondary-900">{amountText || "অর্ডারের টাকা"}</span>{" "}
              লিখে পিন দিয়ে পেমেন্ট সম্পন্ন করুন।
            </Step>
            <Step n={5}>যে বিকাশ নাম্বার থেকে টাকা দিয়েছেন সেটি নিচের ঘরে লিখে সাবমিট করুন।</Step>
          </ol>
        </div>

        {/* Video tutorial */}
        {videoId && (
          <div className="overflow-hidden rounded-lg border border-red-100">
            {showVideo ? (
              <>
                <div className="relative aspect-video w-full bg-black">
                  {/* YouTube refuses to play (error 153) when the embed gets no
                      referrer, so send the origin explicitly. */}
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`}
                    title="Bangla QR পেমেন্ট টিউটোরিয়াল"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
                <a
                  href={`https://www.youtube.com/watch?v=${videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  ভিডিও চালু না হলে এখানে চাপুন — YouTube-এ খুলবে
                </a>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowVideo(true)}
                className="flex w-full items-center gap-3 bg-red-50 px-3 py-3 text-left hover:bg-red-100"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-5 w-5">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                <span>
                  <span className="block text-sm font-bold text-red-700">বুঝতে সমস্যা? ভিডিও দেখুন</span>
                  <span className="block text-xs text-gray-600">কিভাবে QR দিয়ে পেমেন্ট করবেন — ধাপে ধাপে দেখানো হয়েছে</span>
                </span>
              </button>
            )}
          </div>
        )}

        {/* Payer number */}
        <div>
          <label htmlFor="payerNumber" className="mb-1 block text-sm font-bold text-secondary-900">
            যে বিকাশ নাম্বার থেকে টাকা দিয়েছেন
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <PhoneIcon className="h-4 w-4 text-gray-400" />
            </span>
            <input
              id="payerNumber"
              name="payerNumber"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={14}
              required
              value={payer}
              onChange={(e) => setPayer(e.target.value)}
              placeholder="01XXXXXXXXX"
              className={`w-full rounded-lg border-2 py-2.5 pl-9 pr-9 font-mono text-base tracking-wider focus:outline-none ${
                payerLooksValid ? "border-green-500" : "border-gray-300 focus:border-pink-500"
              }`}
            />
            {payerLooksValid && (
              <span className="absolute inset-y-0 right-3 flex items-center text-green-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                </svg>
              </span>
            )}
          </div>
          {error ? (
            <p className="mt-1 text-sm text-red-600">{error}</p>
          ) : (
            digits.length > 0 &&
            !payerLooksValid && <p className="mt-1 text-xs text-orange-600">১১ ডিজিটের বিকাশ নাম্বার লিখুন (যেমন 017XXXXXXXX)</p>
          )}
        </div>

        <div className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
          <ClockIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            পেমেন্ট করার <span className="font-bold">৫ মিনিটের মধ্যে</span> সাবমিট করুন। ঠিক {amountText || "অর্ডারের"} টাকা
            পাঠাবেন — কম বা বেশি পাঠালে অটো অনুমোদন হবে না। নাম্বার ও টাকা মিলে গেলে অর্ডার নিজে থেকেই অনুমোদন হয়ে যাবে।
          </p>
        </div>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-sm leading-snug text-gray-700">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: BKASH_PINK }}
      >
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

function QrIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path strokeLinecap="round" d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path strokeLinecap="round" d="M11 18h2" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 7v5l3 2" />
    </svg>
  );
}
