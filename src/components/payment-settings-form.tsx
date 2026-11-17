"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { updatePaymentSettingsAction } from "@/lib/actions/admin-actions";
import type { ActionState } from "@/lib/actions/auth-actions";

type PaymentSettingsValues = {
  bkashNumber: string;
  nagadNumber: string;
  rocketNumber: string;
  bkashMinAmount: number;
  bkashMinWarning: string | null;
  bkashMinMode: string;
  banglaQrImage: string | null;
  banglaQrVideoUrl: string | null;
};

type Mode = "OFF" | "WARNING" | "BANGLA_QR";

const initialState: ActionState = {};

export function PaymentSettingsForm({ defaultValues }: { defaultValues: PaymentSettingsValues }) {
  const [state, formAction, pending] = useActionState(updatePaymentSettingsAction, initialState);
  const [mode, setMode] = useState<Mode>(
    defaultValues.bkashMinMode === "OFF" || defaultValues.bkashMinMode === "BANGLA_QR"
      ? defaultValues.bkashMinMode
      : "WARNING"
  );
  const [qrPreview, setQrPreview] = useState<string | null>(defaultValues.banglaQrImage);

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

      <Section title="bKash সর্বনিম্ন অ্যামাউন্ট — ওয়ার্নিং / Bangla QR">
        <p className="-mt-2 text-xs text-gray-500">
          এখানে যে অ্যামাউন্ট দেবেন (যেমন <span className="font-semibold">150</span>), তার নিচের অর্ডারে বা ডিপোজিটে
          কাস্টমার bKash সিলেক্ট করলে নিচে বেছে নেওয়া অপশনটি কাজ করবে। Nagad ও Rocket আগের মতোই নাম্বার দেখাবে।
          অ্যামাউন্ট <span className="font-semibold">0</span> দিলে পুরোপুরি বন্ধ থাকবে।
        </p>
        <div className="max-w-[220px]">
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
          <p className="mb-2 text-sm font-semibold">এই অ্যামাউন্টের নিচে bKash সিলেক্ট করলে কী দেখাবে?</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <ModeOption
              value="OFF"
              current={mode}
              onChange={setMode}
              title="কিছুই না (বন্ধ)"
              description="আগের মতো bKash নাম্বার দেখাবে, কোনো ওয়ার্নিং নেই।"
            />
            <ModeOption
              value="WARNING"
              current={mode}
              onChange={setMode}
              title="ওয়ার্নিং মেসেজ"
              description="bKash নাম্বারের জায়গায় আপনার লেখা ওয়ার্নিং দেখাবে।"
            />
            <ModeOption
              value="BANGLA_QR"
              current={mode}
              onChange={setMode}
              title="Bangla QR পেমেন্ট"
              description="QR কোড দেখাবে — কাস্টমার বিকাশ অ্যাপে QR স্ক্যান করে পে করবে, SMS মিলে অটো অনুমোদন।"
            />
          </div>
        </div>

        <div className={mode === "WARNING" ? "" : "hidden"}>
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

        <div className={mode === "BANGLA_QR" ? "space-y-4" : "hidden"}>
          <div className="rounded-lg bg-green-50 px-3 py-2.5 text-xs leading-relaxed text-green-800">
            <p className="font-bold">অটো ভেরিফিকেশন কীভাবে কাজ করে:</p>
            <p>
              কাস্টমার QR এ পেমেন্ট করে যে বিকাশ নাম্বার থেকে টাকা পাঠিয়েছে সেটি সাবমিট করে। ব্যাংকের (BANK.ASIA) SMS
              আসলে নাম্বারের প্রথম ৬ ও শেষ ৪ ডিজিট আর টাকার পরিমাণ মিললে এবং ৫ মিনিটের মধ্যে হলে অর্ডার/ডিপোজিট অটো
              অনুমোদন হবে। এর জন্য <span className="font-semibold">SMS Settings</span> পেজে Sender Name{" "}
              <span className="font-mono font-semibold">BANK.ASIA</span> যোগ করে Method{" "}
              <span className="font-semibold">BANK.ASIA (Bangla QR)</span> সিলেক্ট করুন।
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <div>
              {qrPreview ? (
                <Image
                  src={qrPreview}
                  alt="Bangla QR"
                  width={160}
                  height={160}
                  unoptimized
                  className="h-40 w-40 rounded-lg border border-gray-200 bg-white object-contain p-1"
                />
              ) : (
                <div className="flex h-40 w-40 items-center justify-center rounded-lg border border-dashed border-gray-300 text-center text-xs text-gray-400">
                  QR ছবি নেই
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold" htmlFor="banglaQrImageFile">
                  Bangla QR কোডের ছবি (PNG/JPG)
                </label>
                <input
                  id="banglaQrImageFile"
                  name="banglaQrImageFile"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setQrPreview(URL.createObjectURL(file));
                  }}
                  className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-700"
                />
                {state.fieldErrors?.banglaQrImage && (
                  <p className="mt-1 text-sm text-red-600">{state.fieldErrors.banglaQrImage}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold" htmlFor="banglaQrVideoUrl">
                  টিউটোরিয়াল ভিডিও (YouTube লিংক, ঐচ্ছিক)
                </label>
                <input
                  id="banglaQrVideoUrl"
                  name="banglaQrVideoUrl"
                  type="url"
                  defaultValue={defaultValues.banglaQrVideoUrl ?? ""}
                  placeholder="https://youtu.be/xxxxxxxxxxx"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                {state.fieldErrors?.banglaQrVideoUrl && (
                  <p className="mt-1 text-sm text-red-600">{state.fieldErrors.banglaQrVideoUrl}</p>
                )}
              </div>
            </div>
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

function ModeOption({
  value,
  current,
  onChange,
  title,
  description,
}: {
  value: Mode;
  current: Mode;
  onChange: (v: Mode) => void;
  title: string;
  description: string;
}) {
  const active = value === current;
  return (
    <label
      className={`flex cursor-pointer gap-2 rounded-lg border-2 p-3 transition-colors ${
        active ? "border-primary-500 bg-primary-50" : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <input
        type="radio"
        name="bkashMinMode"
        value={value}
        checked={active}
        onChange={() => onChange(value)}
        className="mt-0.5 accent-primary-500"
      />
      <span>
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs text-gray-500">{description}</span>
      </span>
    </label>
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
