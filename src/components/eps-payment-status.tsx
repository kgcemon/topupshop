"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { checkEpsPaymentStatusAction, type EpsStatusView } from "@/lib/actions/eps-actions";
import { WhatsappLink, WhatsAppIcon } from "@/components/whatsapp-link";
import { formatOrderNumber, formatTaka } from "@/lib/utils";

// Poll fast while the customer is most likely watching, then ease off; keep
// going for a good while, since the background reconciler may settle the
// payment later even when EPS is slow to confirm it.
const POLL_SCHEDULE_MS = [2000, 3000, 3000, 4000, 5000, 5000, 8000, 10000];
const MAX_POLL_MS = 10 * 60 * 1000;

export function EpsPaymentStatus({
  refId,
  found,
  purpose,
  isGuest,
  amount,
  merchantTransactionId,
  financialEntity,
  product,
  whatsappNumber,
  initial,
}: {
  refId: string;
  found: boolean;
  purpose: "ORDER" | "DEPOSIT";
  isGuest: boolean;
  amount: number;
  merchantTransactionId: string | null;
  financialEntity: string | null;
  product: { name: string; label: string; href: string } | null;
  whatsappNumber: string;
  initial: EpsStatusView | null;
}) {
  const [view, setView] = useState<EpsStatusView | null>(initial);
  const startedAt = useRef(0);
  const [gaveUp, setGaveUp] = useState(false);

  // Failed/cancelled are re-checked a few times as well: EPS can confirm a
  // retried attempt within the same session.
  const shouldPoll = !!view && (view.status === "PENDING" || view.status === "FAILED" || view.status === "CANCELLED");
  const pollBudgetMs = view?.status === "PENDING" ? MAX_POLL_MS : 30 * 1000;

  useEffect(() => {
    if (!shouldPoll || gaveUp) return;
    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout>;
    if (startedAt.current === 0) startedAt.current = Date.now();

    const run = async () => {
      if (cancelled) return;
      if (Date.now() - startedAt.current > pollBudgetMs) {
        setGaveUp(true);
        return;
      }
      try {
        const next = await checkEpsPaymentStatusAction(refId);
        if (cancelled) return;
        if (next) {
          setView(next);
          if (next.status === "SUCCESS" || next.status === "EXPIRED") return;
        }
      } catch {
        // Network blip — just try again on the next tick.
      }
      timer = setTimeout(run, POLL_SCHEDULE_MS[Math.min(attempt++, POLL_SCHEDULE_MS.length - 1)]);
    };
    timer = setTimeout(run, POLL_SCHEDULE_MS[0]);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refId, shouldPoll, gaveUp, pollBudgetMs]);

  if (!found || !view) {
    return (
      <Card tone="error" title="পেমেন্টটি খুঁজে পাওয়া যায়নি" text="লিংকটি সঠিক নয় অথবা মেয়াদ শেষ হয়ে গেছে। টাকা কাটা হয়ে থাকলে সাপোর্টে যোগাযোগ করুন — কোনো পেমেন্ট হারাবে না।">
        <Actions>
          <PrimaryLink href="/">হোম পেজে যান</PrimaryLink>
          <SupportLink whatsappNumber={whatsappNumber} message="আসসালামু আলাইকুম, আমার অটো পেমেন্ট নিয়ে সাহায্য দরকার।" />
        </Actions>
      </Card>
    );
  }

  const supportMessage = `আসসালামু আলাইকুম, আমার অটো পেমেন্ট (ID: ${merchantTransactionId ?? refId}, ৳${formatTaka(amount)}) নিয়ে সাহায্য দরকার।`;

  return (
    <Card tone={view.tone} title={view.title} text={gaveUp && view.status === "PENDING" ? "নিশ্চিতকরণ আসতে দেরি হচ্ছে। পেমেন্ট সম্পন্ন হয়ে থাকলে কিছুক্ষণের মধ্যে স্বয়ংক্রিয়ভাবে যোগ হয়ে যাবে — পেজটি পরে রিফ্রেশ করে দেখুন।" : view.text}>
      <dl className="space-y-2 rounded-lg bg-gray-50 p-4 text-sm">
        <Row label="পরিমাণ" value={`৳${formatTaka(amount)}`} strong />
        {purpose === "ORDER" && product && <Row label="প্রোডাক্ট" value={`${product.name} — ${product.label}`} />}
        {purpose === "DEPOSIT" && <Row label="উদ্দেশ্য" value="ওয়ালেটে টাকা যোগ" />}
        {view.orderSerial !== null && <Row label="অর্ডার নাম্বার" value={formatOrderNumber(view.orderSerial)} strong />}
        {financialEntity && <Row label="মাধ্যম" value={financialEntity} />}
        {merchantTransactionId && <Row label="পেমেন্ট আইডি" value={merchantTransactionId} mono />}
      </dl>

      <Actions>
        {view.status === "SUCCESS" ? (
          purpose === "DEPOSIT" ? (
            <PrimaryLink href="/dashboard">ওয়ালেট দেখুন</PrimaryLink>
          ) : isGuest ? (
            <p className="rounded-md bg-gray-50 px-4 py-3 text-center text-xs text-gray-600">
              অর্ডার নাম্বারটি সংরক্ষণ করুন — স্ট্যাটাস জানতে WhatsApp সাপোর্টে যোগাযোগ করুন।
            </p>
          ) : (
            <PrimaryLink href="/dashboard/orders">অর্ডার হিস্টোরি দেখুন</PrimaryLink>
          )
        ) : view.status === "PENDING" ? null : (
          <PrimaryLink href={purpose === "DEPOSIT" ? "/dashboard/deposit" : product?.href ?? "/"}>আবার চেষ্টা করুন</PrimaryLink>
        )}
        <SupportLink whatsappNumber={whatsappNumber} message={supportMessage} />
      </Actions>
    </Card>
  );
}

function Card({
  tone,
  title,
  text,
  children,
}: {
  tone: "success" | "error" | "pending";
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  const styles = {
    success: { ring: "bg-green-500", head: "bg-green-50", title: "text-green-700" },
    error: { ring: "bg-red-500", head: "bg-red-50", title: "text-red-700" },
    pending: { ring: "bg-primary-500", head: "bg-primary-50", title: "text-primary-700" },
  }[tone];

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm" aria-live="polite">
      <div className={`flex flex-col items-center px-6 pb-5 pt-8 text-center ${styles.head}`}>
        <span className={`mb-3 flex h-14 w-14 items-center justify-center rounded-full text-white ${styles.ring}`}>
          {tone === "success" ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-7 w-7" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : tone === "error" ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-7 w-7" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          ) : (
            <svg className="h-7 w-7 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
            </svg>
          )}
        </span>
        <h1 className={`text-lg font-bold ${styles.title}`}>{title}</h1>
        <p className="mt-1 max-w-sm text-sm text-gray-600">{text}</p>
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </div>
  );
}

function Row({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={`text-right ${strong ? "font-bold" : "font-semibold"} ${mono ? "break-all font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block w-full rounded-md bg-primary-500 py-2.5 text-center font-bold text-white hover:bg-primary-600">
      {children}
    </Link>
  );
}

function SupportLink({ whatsappNumber, message }: { whatsappNumber: string; message: string }) {
  return (
    <WhatsappLink
      whatsappNumber={whatsappNumber}
      message={message}
      className="flex w-full items-center justify-center gap-2 rounded-md bg-green-600 py-2.5 text-center font-bold text-white hover:bg-green-700"
    >
      <WhatsAppIcon />
      Help Line
    </WhatsappLink>
  );
}
