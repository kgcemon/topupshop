"use client";

import { useActionState } from "react";
import { updatePaymentSettingsAction } from "@/lib/actions/admin-actions";
import type { ActionState } from "@/lib/actions/auth-actions";

type PaymentSettingsValues = {
  bkashNumber: string;
  nagadNumber: string;
  rocketNumber: string;
  bkashMinAmount: number;
  bkashMinWarning: string | null;
};

const initialState: ActionState = {};

export function PaymentSettingsForm({ defaultValues }: { defaultValues: PaymentSettingsValues }) {
  const [state, formAction, pending] = useActionState(updatePaymentSettingsAction, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <Section title="পেমেন্ট নাম্বার (Manual Pay)">
        <p className="-mt-2 mb-2 text-xs text-gray-500">
          এই নাম্বারগুলোই টপআপ পেজে ও ওয়ালেট ডিপোজিট পেজে কাস্টমারকে দেখানো হয়।
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="bKash নাম্বার"
            name="bkashNumber"
            defaultValue={defaultValues.bkashNumber}
            error={state.fieldErrors?.bkashNumber}
          />
          <Field
            label="Nagad নাম্বার"
            name="nagadNumber"
            defaultValue={defaultValues.nagadNumber}
            error={state.fieldErrors?.nagadNumber}
          />
          <Field
            label="Rocket নাম্বার"
            name="rocketNumber"
            defaultValue={defaultValues.rocketNumber}
            error={state.fieldErrors?.rocketNumber}
          />
        </div>
      </Section>

      <Section title="bKash সর্বনিম্ন অ্যামাউন্ট ওয়ার্নিং">
        <p className="-mt-2 text-xs text-gray-500">
          এখানে যে অ্যামাউন্ট দেবেন (যেমন <span className="font-semibold">150</span>), তার নিচের অর্ডারে বা
          ডিপোজিটে bKash সিলেক্ট করলে bKash নাম্বারের জায়গায় নিচের ওয়ার্নিং মেসেজটি দেখাবে — নাম্বার
          লুকানো থাকবে। Nagad ও Rocket আগের মতোই নাম্বার দেখাবে। অ্যামাউন্ট <span className="font-semibold">0</span>{" "}
          দিলে এই ওয়ার্নিং পুরোপুরি বন্ধ থাকবে।
        </p>
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <div>
            <label className="mb-1 block text-sm font-semibold" htmlFor="bkashMinAmount">
              সর্বনিম্ন অ্যামাউন্ট (টাকা)
            </label>
            <input
              id="bkashMinAmount"
              name="bkashMinAmount"
              type="number"
              min={0}
              step={1}
              defaultValue={defaultValues.bkashMinAmount}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {state.fieldErrors?.bkashMinAmount && (
              <p className="mt-1 text-sm text-red-600">{state.fieldErrors.bkashMinAmount}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold" htmlFor="bkashMinWarning">
              ওয়ার্নিং মেসেজ (bKash নাম্বারের জায়গায় দেখাবে)
            </label>
            <textarea
              id="bkashMinWarning"
              name="bkashMinWarning"
              rows={3}
              defaultValue={defaultValues.bkashMinWarning ?? ""}
              placeholder="যেমন: ১৫০ টাকার নিচে bKash এ পেমেন্ট করা যাবে না — Nagad অথবা Rocket ব্যবহার করুন।"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {state.fieldErrors?.bkashMinWarning && (
              <p className="mt-1 text-sm text-red-600">{state.fieldErrors.bkashMinWarning}</p>
            )}
          </div>
        </div>
      </Section>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-primary-500 py-2.5 font-bold text-white hover:bg-primary-600 disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {pending ? "সেভ হচ্ছে..." : "সেভ করুন"}
      </button>
      {state.success && <p className="text-sm font-semibold text-primary-600">পেমেন্ট সেটিংস সেভ হয়েছে।</p>}
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-base font-bold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  error,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold">{label}</label>
      <input
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
