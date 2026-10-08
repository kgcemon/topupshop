"use client";

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import { depositAction } from "@/lib/actions/wallet-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { PaymentNumberCard } from "@/components/payment-number-card";

const initialState: ActionState = {};

type ManualMethod = "BKASH" | "NAGAD" | "ROCKET";

const METHOD_COLORS: Record<ManualMethod, string> = {
  BKASH: "#E2136E",
  NAGAD: "#F42534",
  ROCKET: "#8C3494",
};

const METHOD_LABELS: Record<ManualMethod, string> = {
  BKASH: "bKash",
  NAGAD: "Nagad",
  ROCKET: "Rocket",
};

// Same ordering rule as the order form: bKash leads, except under the admin's
// minimum amount, where it moves to the end.
const METHODS: readonly ManualMethod[] = ["BKASH", "NAGAD", "ROCKET"];
const METHODS_BELOW_MIN: readonly ManualMethod[] = ["NAGAD", "ROCKET", "BKASH"];

// Mirrors depositSchema in lib/validation.ts.
const MIN_AMOUNT = 20;
const MAX_AMOUNT = 100000;
const QUICK_AMOUNTS = [100, 200, 500, 1000];

// A short pause before the methods appear, so the step change reads as one.
const REVEAL_DELAY_MS = 700;

type Step = "amount" | "loading" | "pay";

function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  );
}

export function DepositForm({
  numbers,
  icons,
  bkashMinAmount,
  bkashMinWarning,
}: {
  numbers: { bkashNumber: string; nagadNumber: string; rocketNumber: string };
  icons: { bkashIcon: string | null; nagadIcon: string | null; rocketIcon: string | null };
  bkashMinAmount: number;
  bkashMinWarning: string | null;
}) {
  const [step, setStep] = useState<Step>("amount");
  const [method, setMethod] = useState<ManualMethod>("BKASH");
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(depositAction, initialState);

  useEffect(() => {
    if (step !== "loading") return;
    const timer = setTimeout(() => setStep("pay"), REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [step]);

  const iconFor = (m: ManualMethod) =>
    m === "BKASH" ? icons.bkashIcon : m === "NAGAD" ? icons.nagadIcon : icons.rocketIcon;

  const receivingNumber =
    method === "BKASH" ? numbers.bkashNumber : method === "NAGAD" ? numbers.nagadNumber : numbers.rocketNumber;
  const methodIcon = iconFor(method);

  // Same guard as the order form, judged on the amount being typed.
  const typedAmount = Number(amount);
  const bkashBelowMin =
    bkashMinAmount > 0 &&
    Number.isFinite(typedAmount) &&
    typedAmount > 0 &&
    typedAmount < bkashMinAmount;
  const methods = bkashBelowMin ? METHODS_BELOW_MIN : METHODS;

  // Whenever the ordering flips, pick whatever now sits first.
  const [wasBelowMin, setWasBelowMin] = useState(bkashBelowMin);
  if (wasBelowMin !== bkashBelowMin) {
    setWasBelowMin(bkashBelowMin);
    setMethod(methods[0]);
  }

  const bkashWarning = method === "BKASH" && bkashBelowMin ? bkashMinWarning : null;

  function handleContinue() {
    if (!amount.trim() || !Number.isInteger(typedAmount) || typedAmount < MIN_AMOUNT) {
      setAmountError(`সর্বনিম্ন ${MIN_AMOUNT} টাকা দিন`);
      return;
    }
    if (typedAmount > MAX_AMOUNT) {
      setAmountError(`সর্বোচ্চ ${MAX_AMOUNT} টাকা দেওয়া যাবে`);
      return;
    }
    setAmountError(null);
    setStep("loading");
  }

  if (state.success) {
    return (
      <div className="deposit-step-in rounded-xl border border-green-200 bg-green-50 p-5 text-center">
        <span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-green-500 text-white">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="text-sm font-semibold text-green-700">
          রিকোয়েস্টটি সাবমিট হয়েছে। অ্যাডমিন যাচাই করে ওয়ালেটে টাকা যোগ করবেন।
        </p>
      </div>
    );
  }

  if (step !== "pay") {
    const loading = step === "loading";
    return (
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-700" htmlFor="amount">
            কত টাকা যোগ করতে চান?
          </label>
          <div
            className={`flex items-center rounded-xl border-2 bg-white px-4 transition focus-within:border-primary-500 focus-within:ring-4 focus-within:ring-primary-500/15 ${
              amountError ? "border-red-400" : "border-gray-200"
            }`}
          >
            <span className="text-2xl font-bold text-gray-400">৳</span>
            <input
              id="amount"
              type="number"
              inputMode="numeric"
              min={MIN_AMOUNT}
              max={MAX_AMOUNT}
              placeholder="0"
              autoFocus
              disabled={loading}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setAmountError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleContinue();
                }
              }}
              className="w-full min-w-0 bg-transparent px-3 py-3.5 text-2xl font-bold text-gray-900 placeholder:text-gray-300 focus:outline-none disabled:opacity-70 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="text-sm font-semibold text-gray-400">BDT</span>
          </div>
          {amountError ? (
            <p className="mt-1.5 text-sm text-red-600">{amountError}</p>
          ) : (
            <p className="mt-1.5 text-xs text-gray-500">সর্বনিম্ন {MIN_AMOUNT} টাকা</p>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {QUICK_AMOUNTS.map((q) => {
            const active = typedAmount === q;
            return (
              <button
                type="button"
                key={q}
                disabled={loading}
                onClick={() => {
                  setAmount(String(q));
                  setAmountError(null);
                }}
                className={`rounded-lg border py-2 text-sm font-bold transition disabled:opacity-60 ${
                  active
                    ? "border-primary-500 bg-primary-50 text-primary-600"
                    : "border-gray-200 text-gray-600 hover:border-primary-300 hover:bg-primary-50/50"
                }`}
              >
                ৳{q}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleContinue}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 py-3.5 text-base font-bold text-white shadow-lg shadow-primary-500/25 transition hover:bg-primary-600 active:scale-[0.99] disabled:cursor-wait disabled:opacity-80"
        >
          {loading ? (
            <>
              <Spinner />
              লোড হচ্ছে...
            </>
          ) : (
            "Click here to add money"
          )}
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="deposit-step-in space-y-4">
      <input type="hidden" name="method" value={method} />
      <input type="hidden" name="amount" value={amount} />

      <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-4 py-3 text-white">
        <div>
          <p className="text-xs opacity-80">যোগ করবেন</p>
          <p className="text-2xl font-extrabold">৳{amount}</p>
        </div>
        <button
          type="button"
          onClick={() => setStep("amount")}
          className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold transition hover:bg-white/30"
        >
          পরিবর্তন
        </button>
      </div>
      {state.fieldErrors?.amount && <p className="-mt-2 text-sm text-red-600">{state.fieldErrors.amount}</p>}

      <div>
        <p className="mb-2 text-sm font-semibold text-gray-700">পেমেন্ট মেথড বেছে নিন</p>
        <div className="grid grid-cols-3 gap-2">
          {methods.map((m, i) => {
            const icon = iconFor(m);
            const active = method === m;
            return (
              <button
                type="button"
                key={m}
                onClick={() => setMethod(m)}
                style={{
                  animationDelay: `${i * 70}ms`,
                  borderColor: active ? METHOD_COLORS[m] : undefined,
                  backgroundColor: active ? `${METHOD_COLORS[m]}0F` : undefined,
                }}
                className={`deposit-step-in relative flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-sm font-bold transition ${
                  active ? "shadow-md" : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {active && (
                  <span
                    className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: METHOD_COLORS[m] }}
                  >
                    <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" aria-hidden="true">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
                {icon ? (
                  <Image src={icon} alt={m} width={36} height={36} unoptimized className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: METHOD_COLORS[m] }}
                  >
                    {m.charAt(0)}
                  </span>
                )}
                <span style={{ color: active ? METHOD_COLORS[m] : undefined }}>{METHOD_LABELS[m]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <PaymentNumberCard
          method={method}
          number={receivingNumber}
          warning={bkashWarning}
          icon={
            methodIcon ? (
              <Image src={methodIcon} alt={method} width={20} height={20} unoptimized className="h-5 w-5 shrink-0 rounded-full object-cover" />
            ) : undefined
          }
        />
        {!bkashWarning && (
          <p className="mt-1.5 text-xs text-gray-500">
            উপরের নাম্বারে ৳{amount} Send Money করে নিচে Transaction ID দিন।
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-gray-700" htmlFor="transactionId">
          Transaction ID
        </label>
        <input
          id="transactionId"
          name="transactionId"
          required
          placeholder="যেমন: 8N7A6B5C4D"
          className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 font-semibold tracking-wide placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-300 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/15"
        />
        {state.fieldErrors?.transactionId && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.transactionId}</p>
        )}
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 py-3.5 font-bold text-white shadow-lg shadow-primary-500/25 transition hover:bg-primary-600 disabled:opacity-60"
      >
        {pending ? (
          <>
            <Spinner />
            সাবমিট হচ্ছে...
          </>
        ) : (
          "Submit Deposit Request"
        )}
      </button>
    </form>
  );
}
