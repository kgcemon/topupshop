type IpApiResponse = {
  status: "success" | "fail";
  country?: string;
  city?: string;
};

/**
 * Best-effort coarse geolocation from an IP via the free ip-api.com endpoint.
 * Never throws — callers rely on this to fail silently (localhost, network
 * errors, rate limits, timeouts) rather than block whatever triggered it.
 */
export async function lookupIpLocation(ip: string): Promise<string | null> {
  if (!ip || ip === "unknown" || ip.startsWith("127.") || ip === "::1") {
    return null;
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city`, {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = (await res.json()) as IpApiResponse;
    if (data.status !== "success") return null;

    const parts = [data.city, data.country].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  } catch {
    return null;
  }
}
