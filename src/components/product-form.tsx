"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import type { ActionState } from "@/lib/actions/auth-actions";

type ProductFormValues = {
  id?: number;
  name?: string;
  slug?: string;
  image?: string;
  sectionId?: number;
  type?: string;
  externalUrl?: string | null;
  category?: string;
  description?: string | null;
  inputLabel?: string | null;
  rules?: string[];
  isActive?: boolean;
  stockOut?: boolean;
  sortOrder?: number;
};

type SectionOption = { id: number; name: string };

const initialState: ActionState = {};

export function ProductForm({
  action,
  defaultValues,
  submitLabel,
  sections,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: ProductFormValues;
  submitLabel: string;
  sections: SectionOption[];
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [imagePreview, setImagePreview] = useState<string | null>(defaultValues?.image ?? null);

  return (
    <form action={formAction} className="space-y-4">
      {defaultValues?.id && <input type="hidden" name="productId" value={defaultValues.id} />}
      <input type="hidden" name="image" value={defaultValues?.image ?? ""} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Name" name="name" defaultValue={defaultValues?.name} error={state.fieldErrors?.name} />
        <TextField
          label="Slug"
          name="slug"
          defaultValue={defaultValues?.slug}
          placeholder="uid-topup-bd-server"
          error={state.fieldErrors?.slug}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold">প্রোডাক্ট ইমেজ</label>
        <div className="flex flex-wrap items-center gap-3">
          {imagePreview && (
            <Image
              src={imagePreview}
              alt="Preview"
              width={64}
              height={64}
              unoptimized
              className="h-16 w-16 rounded-md border border-gray-200 object-cover"
            />
          )}
          <input
            type="file"
            name="imageFile"
            accept="image/*"
            required={!defaultValues?.id}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setImagePreview(URL.createObjectURL(file));
            }}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary-500 file:px-3 file:py-1.5 file:text-white"
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">
          ফোন থেকে সরাসরি গ্যালারি বা ক্যামেরা দিয়ে ছবি সিলেক্ট করা যাবে। JPG/PNG/WEBP, সর্বোচ্চ ৮MB।
        </p>
        {state.fieldErrors?.image && <p className="mt-1 text-sm text-red-600">{state.fieldErrors.image}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold">Section</label>
          <select
            name="sectionId"
            defaultValue={defaultValues?.sectionId ?? sections[0]?.id ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
          {state.fieldErrors?.sectionId && (
            <p className="mt-1 text-sm text-red-600">{state.fieldErrors.sectionId}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">Type</label>
          <select
            name="type"
            defaultValue={defaultValues?.type ?? "NORMAL"}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="NORMAL">NORMAL</option>
            <option value="EXTERNAL_LINK">EXTERNAL_LINK (e.g. Telegram link)</option>
          </select>
        </div>
      </div>

      <TextField
        label="External URL (only for EXTERNAL_LINK type)"
        name="externalUrl"
        defaultValue={defaultValues?.externalUrl ?? ""}
        error={state.fieldErrors?.externalUrl}
      />

      <TextField
        label="Category"
        name="category"
        defaultValue={defaultValues?.category ?? "Free Fire"}
        error={state.fieldErrors?.category}
      />

      <div>
        <label className="mb-1 block text-sm font-semibold">Description</label>
        <textarea
          name="description"
          defaultValue={defaultValues?.description ?? ""}
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <TextField
        label="চেকআউট ইনপুট লেবেল (খালি রাখলে ডিফল্ট 'প্লেয়ার আইডি' থাকবে)"
        name="inputLabel"
        defaultValue={defaultValues?.inputLabel ?? ""}
        placeholder="যেমন: ইউজার আইডি, ইমেইল, UID + Zone ID"
        error={state.fieldErrors?.inputLabel}
      />

      <div>
        <label className="mb-1 block text-sm font-semibold">Rules &amp; Conditions (এক লাইনে একটি)</label>
        <textarea
          name="rules"
          defaultValue={(defaultValues?.rules ?? []).join("\n")}
          rows={5}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold">Sort Order</label>
          <input
            name="sortOrder"
            type="number"
            defaultValue={defaultValues?.sortOrder ?? 0}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-end gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="isActive" defaultChecked={defaultValues?.isActive ?? true} />
            Active (visible on site)
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="stockOut" defaultChecked={defaultValues?.stockOut ?? false} />
            Stock Out
          </label>
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary-500 px-5 py-2 font-bold text-white hover:bg-primary-600 disabled:opacity-60"
      >
        {pending ? "সেভ হচ্ছে..." : submitLabel}
      </button>
      {state.success && <p className="text-sm font-semibold text-primary-600">সেভ হয়েছে।</p>}
    </form>
  );
}

function TextField({
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
