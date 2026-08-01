"use client";

import { useActionState, useEffect, useRef } from "react";
import { createBlogCommentAction, type CommentActionState } from "@/lib/actions/blog-actions";

const initialState: CommentActionState = {};

export function BlogCommentForm({
  postId,
  parentId,
  placeholder = "আপনার মতামত লিখুন...",
  submitLabel = "কমেন্ট করুন",
  compact = false,
  autoFocus = false,
  onSubmitted,
}: {
  postId: number;
  parentId?: string;
  placeholder?: string;
  submitLabel?: string;
  compact?: boolean;
  autoFocus?: boolean;
  onSubmitted?: () => void;
}) {
  const [state, formAction, pending] = useActionState(createBlogCommentAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.commentId) {
      formRef.current?.reset();
      onSubmitted?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.commentId]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <input type="hidden" name="postId" value={postId} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <textarea
        name="content"
        rows={compact ? 2 : 3}
        required
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
      />
      {state.fieldErrors?.content && <p className="text-sm text-red-600">{state.fieldErrors.content}</p>}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className={`rounded-md bg-primary-500 font-bold text-white hover:bg-primary-600 disabled:opacity-60 ${
          compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
        }`}
      >
        {pending ? "পোস্ট হচ্ছে..." : submitLabel}
      </button>
    </form>
  );
}
