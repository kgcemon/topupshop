const SOURCE_PATTERNS: [RegExp, string][] = [
  [/google\./i, "Google"],
  [/facebook\.com|fb\.com|fb\.me/i, "Facebook"],
  [/instagram\.com/i, "Instagram"],
  [/youtube\.com|youtu\.be/i, "YouTube"],
  [/t\.me/i, "Telegram"],
  [/wa\.me|whatsapp\.com/i, "WhatsApp"],
  [/tiktok\.com/i, "TikTok"],
  [/bing\.com/i, "Bing"],
];

/**
 * Derives a coarse attribution label from the HTTP Referer header seen on a
 * user's first touch of /register or /login (see proxy.ts).
 */
export function resolveSignupSource(referer: string | null, ownHost: string): string {
  if (!referer) return "Direct";

  let refererHost: string;
  try {
    refererHost = new URL(referer).hostname;
  } catch {
    return "Direct";
  }

  if (refererHost === ownHost) return "Direct";

  for (const [pattern, label] of SOURCE_PATTERNS) {
    if (pattern.test(refererHost)) return label;
  }

  return "Other";
}
