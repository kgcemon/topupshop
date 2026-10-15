import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAlertSetting, sendMessengerText } from "@/lib/alerts";

// Meta's webhook verification handshake: when the Callback URL is saved in
// the app dashboard, Meta calls this with the Verify Token the admin copied
// from /admin/alerts and expects hub.challenge echoed back.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const setting = await getAlertSetting();
  if (
    params.get("hub.mode") === "subscribe" &&
    setting.messengerVerifyToken &&
    params.get("hub.verify_token") === setting.messengerVerifyToken
  ) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

function validSignature(rawBody: string, header: string | null, appSecret: string) {
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", appSecret).update(rawBody).digest("hex"));
  const given = Buffer.from(header.slice("sha256=".length));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

type MessagingEvent = { sender?: { id?: string }; message?: { text?: string; is_echo?: boolean } };
type WebhookBody = { object?: string; entry?: { messaging?: MessagingEvent[] }[] };

// Incoming Page messages. Only two things matter here: the admin sending the
// one-time connect code (links their Messenger as the alert recipient), and
// any later message from that admin (keeps Meta's 24-hour reply window open).
// Customer messages are ignored. Always answers 200 so Meta doesn't retry.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const setting = await getAlertSetting();

  if (setting.messengerAppSecret) {
    if (!validSignature(rawBody, request.headers.get("x-hub-signature-256"), setting.messengerAppSecret)) {
      return new Response("Invalid signature", { status: 401 });
    }
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    return new Response("EVENT_RECEIVED", { status: 200 });
  }
  if (body.object !== "page") return new Response("EVENT_RECEIVED", { status: 200 });

  const events = (body.entry ?? []).flatMap((entry) => entry.messaging ?? []);
  for (const event of events) {
    const senderId = event.sender?.id;
    const text = event.message?.text?.trim() ?? "";
    if (!senderId || !event.message || event.message.is_echo) continue;

    const code = setting.messengerConnectCode;
    if (code && text.toUpperCase().includes(code.toUpperCase())) {
      const now = new Date();
      await prisma.alertSetting.update({
        where: { id: 1 },
        data: {
          messengerRecipientId: senderId,
          messengerConnectCode: null,
          messengerConnectedAt: now,
          messengerLastInboundAt: now,
          messengerLastError: null,
        },
      });
      setting.messengerConnectCode = null;
      setting.messengerRecipientId = senderId;
      if (setting.messengerPageToken) {
        await sendMessengerText(
          setting.messengerPageToken,
          senderId,
          "✅ সংযুক্ত হয়েছে! এখন থেকে UniPin স্টক কম হলে এখানে অ্যালার্ট পাবেন।",
          now
        );
      }
      revalidatePath("/admin/alerts");
    } else if (senderId === setting.messengerRecipientId) {
      await prisma.alertSetting.update({ where: { id: 1 }, data: { messengerLastInboundAt: new Date() } });
    }
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
}
