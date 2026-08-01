"use client";

import { useEffect, useRef } from "react";
import { incrementBlogPostViewAction } from "@/lib/actions/blog-actions";

export function BlogViewTracker({ postId }: { postId: number }) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    incrementBlogPostViewAction(postId);
  }, [postId]);

  return null;
}
