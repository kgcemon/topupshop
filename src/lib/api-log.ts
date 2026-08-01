import { prisma } from "@/lib/prisma";

// Call this from the future Unipin (or other provider) API client, once wired
// up, right after every request — success or failure — so the raw response is
// on hand when an order gets stuck in RUNNING with no confirming callback.
export async function logApiCall(entry: {
  orderId?: string;
  apiSettingId?: number;
  denom?: string;
  requestBody?: string;
  responseBody?: string;
  statusCode?: number;
  success: boolean;
}) {
  await prisma.apiCallLog.create({
    data: {
      orderId: entry.orderId ?? null,
      apiSettingId: entry.apiSettingId ?? null,
      denom: entry.denom ?? null,
      requestBody: entry.requestBody ?? null,
      responseBody: entry.responseBody ?? null,
      statusCode: entry.statusCode ?? null,
      success: entry.success,
    },
  });
}
