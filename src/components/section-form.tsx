"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/auth-actions";

const initialState: ActionState = {};

export function SectionForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: { id?: number; name?: string; slug?: string; sortOrder?: number; isActive?: boolean };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {defaultValues?.id && <input type="hidden" name="id" value={defaultValues.id} />}
      <div>
        <label className="mb-1 block text-xs font-semibold">Name</label>
        <input
          name="name"
          defaultValue={defaultValues?.name ?? ""}
          required
          placeholder="e.g. Special Offer"
          className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        {state.fieldErrors?.name && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.name}</p>}
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold">Slug</label>
        <input
          name="slug"
          defaultValue={defaultValues?.slug ?? ""}
          required
          placeholder="special-offer"
          className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        {state.fieldErrors?.slug && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.slug}</p>}
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold">Sort Order</label>
        <input
          name="sortOrder"
          type="number"
          defaultValue={defaultValues?.sortOrder ?? 0}
          className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="isActive" defaultChecked={defaultValues?.isActive ?? true} />
        Active
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600 disabled:opacity-60"
      >
        {pending ? "সেভ হচ্ছে..." : submitLabel}
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
