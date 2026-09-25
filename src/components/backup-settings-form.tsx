"use client";

import { useActionState } from "react";
import { saveBackupSettingsAction } from "@/lib/actions/backup-actions";
import type { ActionState } from "@/lib/actions/auth-actions";

const initialState: ActionState = {};

type BackupSettingsValues = {
  enabled: boolean;
  intervalMinutes: number;
  keepCount: number;
  driveFolderName: string;
  googleClientId: string | null;
  hasClientSecret: boolean;
};

export function BackupSettingsForm({ defaultValues }: { defaultValues: BackupSettingsValues }) {
  const [state, formAction, pending] = useActionState(saveBackupSettingsAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={defaultValues.enabled}
          className="mt-1 h-4 w-4"
        />
        <span>
          <span className="block text-sm font-semibold">অটো ব্যাকআপ চালু</span>
          <span className="block text-xs text-gray-500">
            চালু থাকলে নির্ধারিত সময় পরপর ডাটাবেসের SQL ব্যাকআপ Google Drive-এ চলে যাবে।
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold">কত মিনিট পরপর</label>
          <input
            type="number"
            name="intervalMinutes"
            min={5}
            max={10080}
            defaultValue={defaultValues.intervalMinutes}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">৬০ = প্রতি ঘণ্টায় একবার।</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">কয়টি ব্যাকআপ রাখা হবে</label>
          <input
            type="number"
            name="keepCount"
            min={1}
            max={50}
            defaultValue={defaultValues.keepCount}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            নতুন ব্যাকআপের পর এর চেয়ে পুরোনোগুলো Drive থেকে মুছে যাবে।
          </p>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold">Drive ফোল্ডারের নাম</label>
        <input
          name="driveFolderName"
          defaultValue={defaultValues.driveFolderName}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          নাম বদলালে পরের ব্যাকআপের সময় নতুন নামে আরেকটি ফোল্ডার তৈরি হবে না — শুধু প্রথমবার ফোল্ডার
          বানানোর সময় এই নামটি ব্যবহার হয়।
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold">Google OAuth Client ID</label>
          <input
            name="googleClientId"
            defaultValue={defaultValues.googleClientId ?? ""}
            placeholder="xxxxx.apps.googleusercontent.com"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">Google OAuth Client Secret</label>
          <input
            name="googleClientSecret"
            type="password"
            autoComplete="new-password"
            placeholder={defaultValues.hasClientSecret ? "সংরক্ষিত আছে — বদলাতে চাইলে লিখুন" : "GOCSPX-..."}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">সেটিংস সেভ হয়েছে।</p>
      )}

      <button
        disabled={pending}
        className="rounded-md bg-primary-500 px-5 py-2 text-sm font-bold text-white hover:bg-primary-600 disabled:opacity-60"
      >
        {pending ? "সেভ হচ্ছে..." : "সেভ করুন"}
      </button>
    </form>
  );
}
