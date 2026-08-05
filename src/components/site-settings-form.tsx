"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { updateSiteSettingsAction, sendTestEmailAction } from "@/lib/actions/admin-actions";
import type { ActionState } from "@/lib/actions/auth-actions";

type SiteSettingsValues = {
  siteName: string;
  tagline: string;
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  ogImage: string | null;
  favicon: string | null;
  whatsappNumber: string;
  telegramLink: string;
  facebookLink: string | null;
  contactEmail: string;
  bkashNumber: string;
  nagadNumber: string;
  rocketNumber: string;
  bkashIcon: string | null;
  nagadIcon: string | null;
  rocketIcon: string | null;
  walletIcon: string | null;
  referralBonusPercent: number;
  allowGuestOrders: boolean;
  smtpEnabled: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpFromEmail: string | null;
  smtpFromName: string | null;
};

const initialState: ActionState = {};

export function SiteSettingsForm({ defaultValues }: { defaultValues: SiteSettingsValues }) {
  const [state, formAction, pending] = useActionState(updateSiteSettingsAction, initialState);
  const [testState, testFormAction, testPending] = useActionState(sendTestEmailAction, initialState);
  const [ogPreview, setOgPreview] = useState<string | null>(defaultValues.ogImage);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(defaultValues.favicon);
  const [walletIconPreview, setWalletIconPreview] = useState<string | null>(defaultValues.walletIcon);
  const [bkashIconPreview, setBkashIconPreview] = useState<string | null>(defaultValues.bkashIcon);
  const [nagadIconPreview, setNagadIconPreview] = useState<string | null>(defaultValues.nagadIcon);
  const [rocketIconPreview, setRocketIconPreview] = useState<string | null>(defaultValues.rocketIcon);

  return (
    <form action={formAction} className="space-y-6">
      <Section title="সাইট তথ্য">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="সাইটের নাম" name="siteName" defaultValue={defaultValues.siteName} error={state.fieldErrors?.siteName} />
          <Field label="ট্যাগলাইন" name="tagline" defaultValue={defaultValues.tagline} error={state.fieldErrors?.tagline} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">Favicon (ব্রাউজার ট্যাব আইকন)</label>
          <div className="flex flex-wrap items-center gap-3">
            {faviconPreview && (
              <Image
                src={faviconPreview}
                alt="Favicon preview"
                width={40}
                height={40}
                unoptimized
                className="h-10 w-10 rounded-md border border-gray-200 object-contain p-1"
              />
            )}
            <input
              type="file"
              name="faviconFile"
              accept="image/*,.ico"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setFaviconPreview(URL.createObjectURL(file));
              }}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary-500 file:px-3 file:py-1.5 file:text-white"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">PNG, ICO বা SVG — বর্গাকার ইমেজ সবচেয়ে ভালো দেখাবে (যেমন 64x64px)</p>
        </div>
      </Section>

      <Section title="SEO সেটিংস (হোমপেজ &amp; সার্চ ইঞ্জিন)">
        <Field
          label="Meta Title"
          name="metaTitle"
          defaultValue={defaultValues.metaTitle ?? ""}
          placeholder="খালি রাখলে সাইটের নাম ব্যবহার হবে"
          error={state.fieldErrors?.metaTitle}
        />
        <div>
          <label className="mb-1 block text-sm font-semibold">Meta Description</label>
          <textarea
            name="metaDescription"
            defaultValue={defaultValues.metaDescription ?? ""}
            rows={3}
            placeholder="সার্চ রেজাল্টে যে বর্ণনা দেখাবে (সর্বোচ্চ ৩০০ ক্যারেক্টার)"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {state.fieldErrors?.metaDescription && (
            <p className="mt-1 text-sm text-red-600">{state.fieldErrors.metaDescription}</p>
          )}
        </div>
        <Field
          label="Meta Keywords (কমা দিয়ে আলাদা করুন)"
          name="metaKeywords"
          defaultValue={defaultValues.metaKeywords ?? ""}
          placeholder="free fire topup, topupsbd, diamond topup bd"
          error={state.fieldErrors?.metaKeywords}
        />
        <div>
          <label className="mb-1 block text-sm font-semibold">Social Share (OG) ইমেজ</label>
          <div className="flex flex-wrap items-center gap-3">
            {ogPreview && (
              <Image
                src={ogPreview}
                alt="OG preview"
                width={80}
                height={80}
                unoptimized
                className="h-20 w-20 rounded-md border border-gray-200 object-cover"
              />
            )}
            <input
              type="file"
              name="ogImageFile"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setOgPreview(URL.createObjectURL(file));
              }}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary-500 file:px-3 file:py-1.5 file:text-white"
            />
          </div>
        </div>
      </Section>

      <Section title="যোগাযোগ &amp; সোশ্যাল">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="WhatsApp নাম্বার" name="whatsappNumber" defaultValue={defaultValues.whatsappNumber} error={state.fieldErrors?.whatsappNumber} />
          <Field label="Contact Email" name="contactEmail" defaultValue={defaultValues.contactEmail} error={state.fieldErrors?.contactEmail} />
          <Field label="Telegram Link" name="telegramLink" defaultValue={defaultValues.telegramLink} error={state.fieldErrors?.telegramLink} />
          <Field label="Facebook Link" name="facebookLink" defaultValue={defaultValues.facebookLink ?? ""} error={state.fieldErrors?.facebookLink} />
        </div>
      </Section>

      <Section title="পেমেন্ট নাম্বার (Manual Pay)">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="bKash নাম্বার" name="bkashNumber" defaultValue={defaultValues.bkashNumber} error={state.fieldErrors?.bkashNumber} />
          <Field label="Nagad নাম্বার" name="nagadNumber" defaultValue={defaultValues.nagadNumber} error={state.fieldErrors?.nagadNumber} />
          <Field label="Rocket নাম্বার" name="rocketNumber" defaultValue={defaultValues.rocketNumber} error={state.fieldErrors?.rocketNumber} />
        </div>
      </Section>

      <Section title="পেমেন্ট আইকন">
        <p className="-mt-2 mb-2 text-xs text-gray-500">
          স্কয়ার ইমেজ দিন (যেমন 128x128px) — বড় ছবি দিলেও automatically resize হয়ে যাবে, পারফরম্যান্স নিয়ে চিন্তা করতে হবে না।
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <IconField
            label="ওয়ালেট আইকন"
            name="walletIconFile"
            preview={walletIconPreview}
            onChange={(file) => setWalletIconPreview(URL.createObjectURL(file))}
          />
          <IconField
            label="bKash আইকন"
            name="bkashIconFile"
            preview={bkashIconPreview}
            onChange={(file) => setBkashIconPreview(URL.createObjectURL(file))}
          />
          <IconField
            label="Nagad আইকন"
            name="nagadIconFile"
            preview={nagadIconPreview}
            onChange={(file) => setNagadIconPreview(URL.createObjectURL(file))}
          />
          <IconField
            label="Rocket আইকন"
            name="rocketIconFile"
            preview={rocketIconPreview}
            onChange={(file) => setRocketIconPreview(URL.createObjectURL(file))}
          />
        </div>
      </Section>

      <Section title="গেস্ট অর্ডার">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="allowGuestOrders"
            defaultChecked={defaultValues.allowGuestOrders}
            className="mt-1 h-4 w-4 accent-primary-500"
          />
          <span>
            <span className="block text-sm font-semibold">লগইন ছাড়া গেস্ট অর্ডার চালু করুন</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              চালু করলে লগইন না করা ভিজিটররা নাম ও ফোন নাম্বার দিয়ে ম্যানুয়াল পেমেন্টে (bKash/Nagad/Rocket)
              অর্ডার করতে পারবে। ওয়ালেট পেমেন্ট শুধু লগইন করা ইউজারদের জন্য থাকবে।
            </span>
          </span>
        </label>
      </Section>

      <Section title="রেফারেল বোনাস">
        <div className="max-w-xs">
          <label className="mb-1 block text-sm font-semibold">বোনাস হার (%)</label>
          <input
            name="referralBonusPercent"
            type="number"
            step="0.01"
            min={1}
            max={1.5}
            defaultValue={defaultValues.referralBonusPercent}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {state.fieldErrors?.referralBonusPercent && (
            <p className="mt-1 text-sm text-red-600">{state.fieldErrors.referralBonusPercent}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            নতুন ইউজার রেফার করার মাধ্যমে জয়েন করলে এবং তার প্রথম অর্ডার DELIVERED হলে, সেই অর্ডারের
            এই শতাংশ টাকা রেফারার ও নতুন ইউজার দুজনের ওয়ালেটেই বোনাস হিসেবে যোগ হবে। সর্বনিম্ন ১%,
            সর্বোচ্চ ১.৫%।
          </p>
        </div>
      </Section>

      <Section title="ইমেইল (SMTP)">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="smtpEnabled"
            defaultChecked={defaultValues.smtpEnabled}
            className="mt-1 h-4 w-4 accent-primary-500"
          />
          <span>
            <span className="block text-sm font-semibold">অর্ডার ডেলিভারি/বাতিল/রিফান্ড ও ওয়ালেট টপ-আপে ইমেইল পাঠানো চালু করুন</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              চালু করলে নিচের SMTP তথ্য দিয়ে গ্রাহকের ইমেইলে স্বয়ংক্রিয় নোটিফিকেশন পাঠানো হবে। বন্ধ থাকলে
              কোনো ইমেইল পাঠানো হবে না, বাকি সব ফিচার আগের মতোই কাজ করবে।
            </span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="SMTP Host"
            name="smtpHost"
            defaultValue={defaultValues.smtpHost ?? ""}
            placeholder="smtp.gmail.com"
            error={state.fieldErrors?.smtpHost}
          />
          <Field
            label="SMTP Port"
            name="smtpPort"
            defaultValue={String(defaultValues.smtpPort ?? 587)}
            placeholder="587"
            error={state.fieldErrors?.smtpPort}
          />
          <Field
            label="SMTP User (ইমেইল)"
            name="smtpUser"
            defaultValue={defaultValues.smtpUser ?? ""}
            placeholder="you@gmail.com"
            error={state.fieldErrors?.smtpUser}
          />
          <div>
            <label className="mb-1 block text-sm font-semibold">SMTP Password</label>
            <input
              type="password"
              name="smtpPassword"
              placeholder="খালি রাখলে আগের পাসওয়ার্ড থাকবে"
              autoComplete="new-password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <Field
            label="From Email"
            name="smtpFromEmail"
            defaultValue={defaultValues.smtpFromEmail ?? ""}
            placeholder="খালি রাখলে SMTP User ব্যবহার হবে"
            error={state.fieldErrors?.smtpFromEmail}
          />
          <Field
            label="From Name"
            name="smtpFromName"
            defaultValue={defaultValues.smtpFromName ?? ""}
            placeholder="খালি রাখলে সাইটের নাম ব্যবহার হবে"
            error={state.fieldErrors?.smtpFromName}
          />
        </div>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="smtpSecure"
            defaultChecked={defaultValues.smtpSecure}
            className="mt-1 h-4 w-4 accent-primary-500"
          />
          <span>
            <span className="block text-sm font-semibold">SSL (পোর্ট 465)</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              চালু রাখলে implicit TLS (পোর্ট 465) ব্যবহার হবে। বন্ধ থাকলে STARTTLS (পোর্ট 587) ব্যবহার হবে —
              বেশিরভাগ প্রোভাইডারের (Gmail সহ) জন্য এটাই ডিফল্ট।
            </span>
          </span>
        </label>

        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
          <label className="mb-1 block text-sm font-semibold">SMTP কানেকশন টেস্ট করুন</label>
          <p className="mb-3 text-xs text-gray-500">
            আগে উপরের তথ্য <span className="font-semibold">সেভ করুন</span>, তারপর এখানে একটি ইমেইল ঠিকানা
            দিয়ে টেস্ট মেইল পাঠান। সমস্যা থাকলে এখানেই সঠিক কারণ দেখতে পাবেন।
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              name="testEmail"
              type="email"
              placeholder="you@example.com"
              defaultValue={defaultValues.smtpFromEmail || defaultValues.contactEmail || ""}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:flex-1"
            />
            <button
              type="submit"
              formAction={testFormAction}
              formNoValidate
              disabled={testPending}
              className="shrink-0 rounded-md border border-primary-500 px-4 py-2 text-sm font-semibold text-primary-600 hover:bg-primary-50 disabled:opacity-60"
            >
              {testPending ? "পাঠানো হচ্ছে..." : "টেস্ট মেইল পাঠান"}
            </button>
          </div>
          {testState.error && <p className="mt-2 text-sm text-red-600">❌ {testState.error}</p>}
          {testState.success && (
            <p className="mt-2 text-sm font-semibold text-primary-600">✅ টেস্ট মেইল সফলভাবে পাঠানো হয়েছে — ইনবক্স চেক করুন।</p>
          )}
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
      {state.success && <p className="text-sm font-semibold text-primary-600">সেটিংস সেভ হয়েছে।</p>}
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

function IconField({
  label,
  name,
  preview,
  onChange,
}: {
  label: string;
  name: string;
  preview: string | null;
  onChange: (file: File) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold">{label}</label>
      <div className="flex items-center gap-3">
        {preview && (
          <Image
            src={preview}
            alt={`${label} preview`}
            width={40}
            height={40}
            unoptimized
            className="h-10 w-10 rounded-full border border-gray-200 object-contain p-1"
          />
        )}
        <input
          type="file"
          name={name}
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onChange(file);
          }}
          className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary-500 file:px-2 file:py-1 file:text-xs file:text-white"
        />
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  error,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold">{label}</label>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
