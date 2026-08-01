"use client";

import { useState } from "react";
import { BlogCommentForm } from "@/components/blog-comment-form";

function ReplyArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path
        d="M9 10L4 15L9 20M4 15H15C18.3137 15 21 12.3137 21 9C21 5.68629 18.3137 3 15 3H12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BlogCommentThread({
  postId,
  parentId,
  isLoggedIn,
  replyCount,
  children,
}: {
  postId: number;
  parentId: string;
  isLoggedIn: boolean;
  replyCount: number;
  children?: React.ReactNode;
}) {
  const [showForm, setShowForm] = useState(false);
  const [showReplies, setShowReplies] = useState(false);

  return (
    <div>
      <div className="mt-1.5 flex items-center gap-4 pl-12">
        {isLoggedIn && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="text-xs font-bold text-gray-500 hover:text-primary-600"
          >
            {showForm ? "বাতিল" : "রিপ্লাই"}
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-2 ml-12">
          <BlogCommentForm
            postId={postId}
            parentId={parentId}
            compact
            autoFocus
            placeholder="রিপ্লাই লিখুন..."
            submitLabel="রিপ্লাই করুন"
            onSubmitted={() => {
              setShowForm(false);
              setShowReplies(true);
            }}
          />
        </div>
      )}

      {replyCount > 0 && (
        <div className="mt-2 ml-12">
          <button
            type="button"
            onClick={() => setShowReplies((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-primary-600 hover:underline"
          >
            <ReplyArrowIcon />
            {showReplies
              ? "উত্তরগুলো লুকান"
              : `${replyCount} টি উত্তর দেখুন`}
          </button>

          {showReplies && (
            <div className="mt-3 space-y-3 border-l-2 border-gray-100 pl-4">{children}</div>
          )}
        </div>
      )}
    </div>
  );
}
