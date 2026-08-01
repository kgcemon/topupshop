"use client";

import { useActionState, useState } from "react";
import { depositAction } from "@/lib/actions/wallet-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { PaymentNumberCard } from "@/components/payment-number-card";

const initialState: ActionState = {};

export function DepositForm({
  numbers,
}: {
  numbers: { bkashNumber: string; nagadNumber: string; rocketNumber: string };
}) {
  const [method, setMethod] = useState<"BKASH" | "NAGAD" | "ROCKET">("BKASH");
  const [state, formAction, pending] = useActionState(depositAction, initialState);

  const receivingNumber =
    method === "BKASH" ? numbers.bkashNumber : method === "NAGAD" ? numbers.nagadNumber : numbers.rocketNumber;

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
          {(["BKASH", "NAGAD", "ROCKET"] as const).map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => setMethod(m)}
              className={`flex-1 rounded-md border-2 py-1.5 text-xs font-bold ${
                method === m ? "border-primary-500 bg-primary-50" : "border-gray-200"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div>
        <PaymentNumberCard method={method} number={receivingNumber} />
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
