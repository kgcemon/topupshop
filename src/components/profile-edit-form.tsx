"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { updateProfileAction, type ProfileActionState } from "@/lib/actions/profile-actions";

const initialState: ProfileActionState = {};

export function ProfileEditForm({
  name,
  phone,
  image,
  nameLockedUntilLabel,
  levelBadge,
}: {
  name: string | null;
  phone: string | null;
  image: string | null;
  nameLockedUntilLabel: string | null;
  levelBadge: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);
  const [preview, setPreview] = useState<string | null>(image);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { update } = useSession();
  const router = useRouter();

  const currentName = state.values?.name ?? name ?? "";
  const initial = (currentName || "U").trim().charAt(0).toUpperCase();
  const isLocked = Boolean(nameLockedUntilLabel);

  useEffect(() => {
    if (state.success) {
      update();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="space-y-5">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end">
        <div className="relative shrink-0">
          {preview ? (
            <Image
              src={preview}
              alt={currentName || "Profile"}
              width={96}
              height={96}
              unoptimized
              className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-md"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-secondary-900 text-3xl font-bold text-white shadow-md">
              {initial}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="প্রোফাইল ছবি পরিবর্তন করুন"
            className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-primary-500 text-white shadow-md transition-colors hover:bg-primary-600 active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4.5 w-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            name="avatarFile"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setPreview(URL.createObjectURL(file));
            }}
          />
        </div>

        <div className="min-w-0 flex-1 text-center sm:pb-1 sm:text-left">
          <p className="text-lg font-bold text-gray-900">{currentName || "নাম নেই"}</p>
          <div className="mt-1 flex justify-center sm:justify-start">{levelBadge}</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-1 block text-xs font-bold text-gray-500">
            নাম
          </label>
          <input
            id="name"
            name="name"
            defaultValue={name ?? ""}
            readOnly={isLocked}
            required
            minLength={2}
            maxLength={60}
            className={`w-full rounded-lg border px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              isLocked ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-500" : "border-gray-300 bg-white"
            }`}
          />
          {isLocked ? (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
                <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5Zm-3 8V6a3 3 0 1 1 6 0v3Z" />
              </svg>
              মাসে একবারই নাম পরিবর্তন করা যায়। পরবর্তী সুযোগ: {nameLockedUntilLabel}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-gray-400">নাম মাসে একবার পরিবর্তন করা যাবে</p>
          )}
          {state.fieldErrors?.name && <p className="mt-1 text-[11px] text-red-600">{state.fieldErrors.name}</p>}
        </div>

        <div>
          <label htmlFor="phone" className="mb-1 block text-xs font-bold text-gray-500">
            ফোন নাম্বার
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={phone ?? ""}
            required
            placeholder="01xxxxxxxxx"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {state.fieldErrors?.phone && <p className="mt-1 text-[11px] text-red-600">{state.fieldErrors.phone}</p>}
        </div>
      </div>

      {state.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}
      {state.success && (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
          </svg>
          প্রোফাইল সফলভাবে আপডেট হয়েছে
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-primary-500 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-600 disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {pending ? "সেভ হচ্ছে..." : "প্রোফাইল আপডেট করুন"}
      </button>
    </form>
  );
}
