"use client";

import { useEffect, useRef, useState } from "react";
import { checkPlayerNameAction } from "@/lib/actions/name-check-actions";
import { isValidFFNameUid } from "@/lib/ffname-client";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; nickname: string; level: number | null }
  | { kind: "error"; message: string };

// Long enough that a full id typed at speed only costs one lookup, short enough
// that the name lands while the buyer is still looking at the field.
const DEBOUNCE_MS = 600;

/**
 * Shows the in-game name for whatever player id is currently typed, in a strip
 * under the field — so a buyer catches a wrong id before paying rather than
 * after the diamonds land on someone else's account.
 *
 * Reads the live input rather than owning it, so the field stays uncontrolled
 * and the order form keeps submitting it unchanged.
 */
export function PlayerNameCheck({ productId, inputId }: { productId: number; inputId: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  // Lets a slow reply for an older id be discarded once the id has moved on.
  const requestRef = useRef(0);

  useEffect(() => {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (!input) return;

    let timer: ReturnType<typeof setTimeout>;

    function run() {
      const uid = input!.value.trim();
      clearTimeout(timer);

      if (!isValidFFNameUid(uid)) {
        requestRef.current += 1; // cancel any reply still in flight
        setState({ kind: "idle" });
        return;
      }

      setState({ kind: "loading" });
      timer = setTimeout(async () => {
        const ticket = ++requestRef.current;
        const result = await checkPlayerNameAction(productId, uid);
        if (ticket !== requestRef.current) return;
        setState(
          result.ok
            ? { kind: "found", nickname: result.nickname, level: result.level }
            : { kind: "error", message: result.error }
        );
      }, DEBOUNCE_MS);
    }

    input.addEventListener("input", run);
    if (input.value) run(); // an id already filled in (back button, autofill)
    return () => {
      clearTimeout(timer);
      input.removeEventListener("input", run);
    };
  }, [productId, inputId]);

  const base = "mb-3 flex w-full items-center justify-center gap-2 rounded-md px-2.5 py-1.5 text-center text-sm font-semibold";

  if (state.kind === "idle") {
    return (
      <p className={`${base} bg-gray-100 text-gray-500`}>আপনার গেম আইডির নাম চেক করুন</p>
    );
  }

  if (state.kind === "loading") {
    return (
      <p className={`${base} bg-gray-100 text-gray-500`}>
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-500" />
        নাম চেক করা হচ্ছে...
      </p>
    );
  }

  if (state.kind === "error") {
    return <p className={`${base} bg-red-50 text-red-600`}>{state.message}</p>;
  }

  return (
    <p className={`${base} bg-primary-500 text-white`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3.5 w-3.5 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
      </svg>
      <span className="truncate">{state.nickname}</span>
      {state.level !== null && <span className="shrink-0 opacity-80">· Lv {state.level}</span>}
    </p>
  );
}
