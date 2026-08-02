"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { createMarketListingAction, type MarketActionState } from "@/lib/actions/market-actions";

const initialState: MarketActionState = {};
const MAX_IMAGES = 5;

export function MarketListingForm() {
  const [state, formAction, pending] = useActionState(createMarketListingAction, initialState);
  const [previews, setPreviews] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  // React resets uncontrolled form fields after every action run (success or
  // validation error). Remounting on state change + re-applying defaultValue
  // is what makes entered values survive a failed submit — see RegisterForm
  // for the same pattern. The file input additionally needs its FileList
  // rebuilt by hand since a plain `defaultValue` can't restore file inputs.
  const formKey = JSON.stringify(state);

  return (
    <form key={formKey} action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold">গেম</label>
          <input
            name="game"
            defaultValue={state.values?.game}
            placeholder="যেমনঃ Free Fire, PUBG Mobile"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {state.fieldErrors?.game && <p className="mt-1 text-sm text-red-600">{state.fieldErrors.game}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">মূল্য (৳)</label>
          <input
            name="price"
            type="number"
            min={1}
            defaultValue={state.values?.price}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {state.fieldErrors?.price && <p className="mt-1 text-sm text-red-600">{state.fieldErrors.price}</p>}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold">টাইটেল</label>
        <input
          name="title"
          defaultValue={state.values?.title}
          placeholder="যেমনঃ Free Fire ID with Full Rare Bundle"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        {state.fieldErrors?.title && <p className="mt-1 text-sm text-red-600">{state.fieldErrors.title}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold">বিস্তারিত বিবরণ</label>
        <textarea
          name="description"
          rows={5}
          defaultValue={state.values?.description}
          placeholder="আইডির লেভেল, স্কিন, র‍্যাঙ্ক, ইত্যাদি বিস্তারিত লিখুন"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        {state.fieldErrors?.description && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.description}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold">স্ক্রিনশট (সর্বোচ্চ {MAX_IMAGES}টি)</label>
        <input
          type="file"
          name="imageFiles"
          accept="image/*"
          multiple
          ref={(node) => {
            // Runs on every mount of this input, including the remount that
            // follows a failed submit — re-attach the files the user already
            // picked so they aren't silently dropped from the next submit.
            if (node && selectedFiles.length > 0) {
              const dataTransfer = new DataTransfer();
              for (const file of selectedFiles) dataTransfer.items.add(file);
              node.files = dataTransfer.files;
            }
          }}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []).slice(0, MAX_IMAGES);
            setSelectedFiles(files);
            setPreviews(files.map((file) => URL.createObjectURL(file)));
          }}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary-500 file:px-3 file:py-1.5 file:text-white"
        />
        {previews.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {previews.map((src, i) => (
              <Image
                key={i}
                src={src}
                alt="Preview"
                width={64}
                height={64}
                unoptimized
                className="h-16 w-16 rounded-md border border-gray-200 object-cover"
              />
            ))}
          </div>
        )}
        {state.fieldErrors?.images && <p className="mt-1 text-sm text-red-600">{state.fieldErrors.images}</p>}
      </div>

      <div className="rounded-lg border border-primary-200 bg-primary-50 p-4">
        <p className="mb-3 text-xs font-semibold text-gray-600">
          কন্টাক্ট নাম্বার অথবা WhatsApp নাম্বার এর যেকোনো একটি দেওয়া আবশ্যক, যাতে ক্রেতা আপনার সাথে সরাসরি যোগাযোগ করতে পারে।
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold">কন্টাক্ট নাম্বার</label>
            <input
              name="contactNumber"
              defaultValue={state.values?.contactNumber}
              placeholder="01xxxxxxxxx"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {state.fieldErrors?.contactNumber && (
              <p className="mt-1 text-sm text-red-600">{state.fieldErrors.contactNumber}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">WhatsApp নাম্বার</label>
            <input
              name="whatsappNumber"
              defaultValue={state.values?.whatsappNumber}
              placeholder="+8801xxxxxxxxx"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {state.fieldErrors?.whatsappNumber && (
              <p className="mt-1 text-sm text-red-600">{state.fieldErrors.whatsappNumber}</p>
            )}
          </div>
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary-500 px-5 py-2 font-bold text-white hover:bg-primary-600 disabled:opacity-60"
      >
        {pending ? "পোস্ট হচ্ছে..." : "পোস্ট করুন"}
      </button>
      <p className="text-xs text-gray-500">পোস্ট করার পর অ্যাডমিন অনুমোদন দিলে এটি মার্কেটে পাবলিকভাবে দেখাবে।</p>
    </form>
  );
}
