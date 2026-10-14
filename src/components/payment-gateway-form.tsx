"use client";

import { useActionState, useState } from "react";
import { updatePaymentGatewaySettingsAction, testEpsConnectionAction } from "@/lib/actions/eps-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { CopyButton } from "@/components/copy-button";

type GatewayValues = {
  walletPayEnabled: boolean;
  walletPayTitle: string;
  manualPayEnabled: boolean;
  manualPayTitle: string;
  epsEnabled: boolean;
  epsTitle: string;
  epsSubtitle: string | null;
  epsApiBaseUrl: string;
  epsUserName: string | null;
  epsMerchantId: string | null;
  epsStoreId: string | null;
  hasPassword: boolean;
  hasHashKey: boolean;
};

const initialState: ActionState = {};

export function PaymentGatewayForm({ defaultValues, returnUrlExample }: { defaultValues: GatewayValues; returnUrlExample: string }) {
  const [state, formAction, pending] = useActionState(updatePaymentGatewaySettingsAction, initialState);
  const [testState, testAction, testing] = useActionState(testEpsConnectionAction, initialState);
  const [epsOn, setEpsOn] = useState(defaultValues.epsEnabled);
  const e = state.fieldErrors ?? {};

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-6">
        <Section title="পেমেন্ট মেথড (চালু / বন্ধ ও নাম)">
          <p className="-mt-2 text-xs text-gray-500">
            টপআপ পেজে ও ওয়ালেট ডিপোজিট পেজে কোন মেথড দেখাবে এবং কী নামে দেখাবে তা এখান থেকে ঠিক করুন। বন্ধ করা মেথড দিয়ে কেউ পেমেন্ট
            করতে পারবে না।
          </p>
          <MethodRow
            label="১. Wallet Pay"
            hint="ওয়ালেট ব্যালেন্স দিয়ে অর্ডার (শুধু লগইন করা ইউজার)"
            toggleName="walletPayEnabled"
            titleName="walletPayTitle"
            enabled={defaultValues.walletPayEnabled}
            title={defaultValues.walletPayTitle}
            error={e.walletPayTitle}
          />
          <MethodRow
            label="২. Manual Pay"
            hint="bKash / Nagad / Rocket নাম্বারে Send Money করে Transaction ID দেওয়া"
            toggleName="manualPayEnabled"
            titleName="manualPayTitle"
            enabled={defaultValues.manualPayEnabled}
            title={defaultValues.manualPayTitle}
            error={e.manualPayTitle}
          />
          <MethodRow
            label="৩. Auto Pay (EPS)"
            hint="EPS গেটওয়ে দিয়ে bKash / Nagad / Rocket অটো পেমেন্ট — ট্রানজেকশন আইডি লাগে না"
            toggleName="epsEnabled"
            titleName="epsTitle"
            enabled={defaultValues.epsEnabled}
            title={defaultValues.epsTitle}
            error={e.epsTitle}
            onToggle={setEpsOn}
          />
          <div>
            <label className="mb-1 block text-sm font-semibold" htmlFor="epsSubtitle">
              Auto Pay সাবটাইটেল <span className="font-normal text-gray-400">(ঐচ্ছিক)</span>
            </label>
            <input
              id="epsSubtitle"
              name="epsSubtitle"
              defaultValue={defaultValues.epsSubtitle ?? ""}
              placeholder="যেমন: bKash, Nagad, Rocket — সাথে সাথে কনফার্ম"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {e.epsSubtitle && <p className="mt-1 text-sm text-red-600">{e.epsSubtitle}</p>}
          </div>
        </Section>

        <Section title="EPS গেটওয়ে ক্রেডেনশিয়াল">
          <p className="-mt-2 text-xs text-gray-500">
            EPS থেকে পাওয়া তথ্যগুলো দিন। Password ও Hash Key একবার সেভ করার পর আর দেখানো হয় না — বদলাতে চাইলে নতুনটি লিখুন, খালি রাখলে আগেরটিই
            থাকবে। টোকেনের মেয়াদ শেষ হলে সিস্টেম নিজেই নতুন টোকেন নিয়ে নেয়।
          </p>
          {epsOn && (
            <p className="-mt-1 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Auto Pay চালু করতে নিচের সবগুলো ঘর পূরণ থাকতে হবে।
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="API Base URL" name="epsApiBaseUrl" defaultValue={defaultValues.epsApiBaseUrl} error={e.epsApiBaseUrl} mono />
            <Field label="Username" name="epsUserName" defaultValue={defaultValues.epsUserName ?? ""} error={e.epsUserName} autoComplete="off" />
            <Field
              label="Password"
              name="epsPassword"
              type="password"
              placeholder={defaultValues.hasPassword ? "•••••••• (সেভ করা আছে)" : "EPS password"}
              error={e.epsPassword}
              autoComplete="new-password"
            />
            <Field
              label="Hash Key"
              name="epsHashKey"
              type="password"
              placeholder={defaultValues.hasHashKey ? "•••••••• (সেভ করা আছে)" : "EPS hash key"}
              error={e.epsHashKey}
              autoComplete="off"
            />
            <Field label="Merchant ID" name="epsMerchantId" defaultValue={defaultValues.epsMerchantId ?? ""} error={e.epsMerchantId} mono />
            <Field label="Store ID" name="epsStoreId" defaultValue={defaultValues.epsStoreId ?? ""} error={e.epsStoreId} mono />
          </div>
          <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <p className="mb-1 font-semibold text-gray-700">Return URL (স্বয়ংক্রিয় — EPS কে আলাদা করে দিতে হবে না)</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate font-mono">{returnUrlExample}</code>
              <CopyButton value={returnUrlExample} label="" />
            </div>
          </div>
        </Section>

        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-primary-500 py-2.5 font-bold text-white hover:bg-primary-600 disabled:opacity-60 sm:w-auto sm:px-8"
          >
            {pending ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </button>
          {state.success && <p className="text-sm font-semibold text-primary-600">সেটিংস সেভ হয়েছে।</p>}
        </div>
      </form>

      <form action={testAction} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">EPS কানেকশন টেস্ট</p>
          <p className="text-xs text-gray-500">সেভ করা ক্রেডেনশিয়াল দিয়ে EPS থেকে একটি টোকেন নেওয়ার চেষ্টা করে।</p>
        </div>
        <button
          type="submit"
          disabled={testing}
          className="rounded-md border border-primary-500 px-4 py-2 text-sm font-bold text-primary-600 hover:bg-primary-50 disabled:opacity-60"
        >
          {testing ? "টেস্ট হচ্ছে..." : "Test Connection"}
        </button>
        {testState.success && <p className="w-full text-sm font-semibold text-green-600">✓ সংযোগ সফল — EPS টোকেন পাওয়া গেছে।</p>}
        {testState.error && <p className="w-full break-words text-sm text-red-600">{testState.error}</p>}
      </form>
    </div>
  );
}

function MethodRow({
  label,
  hint,
  toggleName,
  titleName,
  enabled,
  title,
  error,
  onToggle,
}: {
  label: string;
  hint: string;
  toggleName: string;
  titleName: string;
  enabled: boolean;
  title: string;
  error?: string;
  onToggle?: (on: boolean) => void;
}) {
  const [on, setOn] = useState(enabled);
  return (
    <div className={`rounded-lg border p-3 transition ${on ? "border-primary-200 bg-primary-50/40" : "border-gray-200 bg-gray-50"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
          <span className="relative inline-flex shrink-0">
            <input
              type="checkbox"
              name={toggleName}
              defaultChecked={enabled}
              onChange={(ev) => {
                setOn(ev.target.checked);
                onToggle?.(ev.target.checked);
              }}
              className="peer sr-only"
            />
            <span className="h-6 w-11 rounded-full bg-gray-300 transition peer-checked:bg-primary-500 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500/40" />
            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold">
              {label} <span className={`ml-1 text-xs font-semibold ${on ? "text-primary-600" : "text-gray-400"}`}>{on ? "চালু" : "বন্ধ"}</span>
            </span>
            <span className="block text-xs text-gray-500">{hint}</span>
          </span>
        </label>
        <div className="w-full sm:w-56">
          <input
            name={titleName}
            defaultValue={title}
            aria-label={`${label} টাইটেল`}
            placeholder="টাইটেল"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
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
  type = "text",
  placeholder,
  autoComplete,
  mono,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  error?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete={autoComplete}
        spellCheck={false}
        className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${mono ? "font-mono" : ""}`}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
