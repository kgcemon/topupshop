"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import type { ActionState } from "@/lib/actions/auth-actions";

type BlogPostFormValues = {
  id?: number;
  title?: string;
  slug?: string;
  excerpt?: string | null;
  content?: string;
  coverImage?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  isPublished?: boolean;
};

const initialState: ActionState = {};

export function BlogPostForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: BlogPostFormValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [coverPreview, setCoverPreview] = useState<string | null>(defaultValues?.coverImage ?? null);

  return (
    <form action={formAction} className="space-y-4">
      {defaultValues?.id && <input type="hidden" name="postId" value={defaultValues.id} />}
      <input type="hidden" name="coverImage" value={defaultValues?.coverImage ?? ""} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="টাইটেল" name="title" defaultValue={defaultValues?.title} error={state.fieldErrors?.title} />
        <TextField
          label="Slug"
          name="slug"
          defaultValue={defaultValues?.slug}
          placeholder="free-fire-diamond-topup-guide"
          error={state.fieldErrors?.slug}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold">কভার ইমেজ</label>
        <div className="flex flex-wrap items-center gap-3">
          {coverPreview && (
            <Image
              src={coverPreview}
              alt="Cover preview"
              width={96}
              height={64}
              unoptimized
              className="h-16 w-24 rounded-md border border-gray-200 object-cover"
            />
          )}
          <input
            type="file"
            name="coverImageFile"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setCoverPreview(URL.createObjectURL(file));
            }}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary-500 file:px-3 file:py-1.5 file:text-white"
          />
        </div>
        {state.fieldErrors?.coverImage && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.coverImage}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold">সংক্ষিপ্ত বিবরণ (Excerpt)</label>
        <textarea
          name="excerpt"
          defaultValue={defaultValues?.excerpt ?? ""}
          rows={2}
          placeholder="ব্লগ লিস্টে ও সার্চ রেজাল্টে এই বর্ণনা দেখাবে"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        {state.fieldErrors?.excerpt && <p className="mt-1 text-sm text-red-600">{state.fieldErrors.excerpt}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold">কনটেন্ট (Markdown সাপোর্ট করে)</label>
        <textarea
          name="content"
          defaultValue={defaultValues?.content ?? ""}
          rows={16}
          placeholder={"## হেডিং\n\nএখানে লিখুন... **বোল্ড**, *ইটালিক*, [লিংক](https://example.com), ![ছবি](https://example.com/image.jpg)\n\n- লিস্ট আইটেম ১\n- লিস্ট আইটেম ২"}
          className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          # হেডিং, **বোল্ড**, *ইটালিক*, [টেক্সট](লিংক), ![অল্ট](ইমেজ লিংক), - লিস্ট — এভাবে ফরম্যাট করা যাবে।
        </p>
        {state.fieldErrors?.content && <p className="mt-1 text-sm text-red-600">{state.fieldErrors.content}</p>}
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-bold">SEO সেটিংস</h2>
        <div className="space-y-3">
          <TextField
            label="Meta Title"
            name="metaTitle"
            defaultValue={defaultValues?.metaTitle ?? ""}
            placeholder="খালি রাখলে টাইটেল ব্যবহার হবে"
            error={state.fieldErrors?.metaTitle}
          />
          <div>
            <label className="mb-1 block text-sm font-semibold">Meta Description</label>
            <textarea
              name="metaDescription"
              defaultValue={defaultValues?.metaDescription ?? ""}
              rows={2}
              placeholder="খালি রাখলে Excerpt ব্যবহার হবে"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {state.fieldErrors?.metaDescription && (
              <p className="mt-1 text-sm text-red-600">{state.fieldErrors.metaDescription}</p>
            )}
          </div>
          <TextField
            label="Meta Keywords (কমা দিয়ে আলাদা করুন)"
            name="metaKeywords"
            defaultValue={defaultValues?.metaKeywords ?? ""}
            placeholder="free fire topup, topupshop blog"
            error={state.fieldErrors?.metaKeywords}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="isPublished" defaultChecked={defaultValues?.isPublished ?? true} />
        Published (সাইটে দেখাবে)
      </label>

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
