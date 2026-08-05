"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { depositAction } from "@/lib/actions/wallet-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { PaymentNumberCard } from "@/components/payment-number-card";

const initialState: ActionState = {};

const METHOD_COLORS: Record<"BKASH" | "NAGAD" | "ROCKET", string> = {
  BKASH: "#E2136E",
  NAGAD: "#F42534",
  ROCKET: "#8C3494",
};

export function DepositForm({
  numbers,
  icons,
}: {
  numbers: { bkashNumber: string; nagadNumber: string; rocketNumber: string };
  icons: { bkashIcon: string | null; nagadIcon: string | null; rocketIcon: string | null };
}) {
  const [method, setMethod] = useState<"BKASH" | "NAGAD" | "ROCKET">("BKASH");
  const [state, formAction, pending] = useActionState(depositAction, initialState);

  const receivingNumber =
    method === "BKASH" ? numbers.bkashNumber : method === "NAGAD" ? numbers.nagadNumber : numbers.rocketNumber;

  const methodIcon =
    method === "BKASH" ? icons.bkashIcon : method === "NAGAD" ? icons.nagadIcon : icons.rocketIcon;

  if (state.success) {
    return (
      <p className="rounded-md bg-green-50 p-3 text-sm font-semibold text-green-700">
        রিকোয়েস্টটি সাবমিট হয়েছে। অ্যাডমিন যাচাই করে ওয়ালেটে টাকা যোগ করবেন।
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="method" value={method} />

      <div>
        <label className="mb-1 block text-sm font-semibold">Payment Method</label>
        <div className="flex gap-2">
          {(["BKASH", "NAGAD", "ROCKET"] as const).map((m) => {
            const icon = m === "BKASH" ? icons.bkashIcon : m === "NAGAD" ? icons.nagadIcon : icons.rocketIcon;
            return (
              <button
                type="button"
                key={m}
                onClick={() => setMethod(m)}
                className={`flex flex-1 flex-col items-center gap-1 rounded-md border-2 py-2 text-xs font-bold ${
                  method === m ? "border-primary-500 bg-primary-50" : "border-gray-200"
                }`}
              >
                {icon ? (
                  <Image src={icon} alt={m} width={24} height={24} unoptimized className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ backgroundColor: METHOD_COLORS[m] }}
                  >
                    {m.charAt(0)}
                  </span>
                )}
                {m}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <PaymentNumberCard
          method={method}
          number={receivingNumber}
          icon={
            methodIcon ? (
              <Image src={methodIcon} alt={method} width={20} height={20} unoptimized className="h-5 w-5 shrink-0 rounded-full object-cover" />
            ) : undefined
          }
        />
        <p className="mt-1.5 text-xs text-gray-500">
          উপরের নাম্বারে টাকা Send Money করে নিচে Amount ও Transaction ID দিন।
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="amount">
          Amount (টাকা)
        </label>
        <input
          id="amount"
          name="amount"
          type="number"
          min={20}
          required
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {state.fieldErrors?.amount && <p className="mt-1 text-sm text-red-600">{state.fieldErrors.amount}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="transactionId">
          Transaction ID
        </label>
        <input
          id="transactionId"
          name="transactionId"
          required
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {state.fieldErrors?.transactionId && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.transactionId}</p>
        )}
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-primary-500 py-2 font-bold text-white hover:bg-primary-600 disabled:opacity-60"
      >
        {pending ? "সাবমিট হচ্ছে..." : "Submit Deposit Request"}
      </button>
    </form>
  );
}
