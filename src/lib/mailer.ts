import nodemailer from "nodemailer";
import { getSiteSettings } from "@/lib/data";

/**
 * Sends a transactional email using the admin-configured SMTP settings.
 * Best-effort only — never throws. Callers invoke this after their real DB
 * work has already committed, so a broken/misconfigured SMTP setup must
 * never surface as a failure of the order/wallet action that triggered it.
 */
export async function sendMail(params: { to: string; subject: string; html: string }) {
  const settings = await getSiteSettings();

  if (
    !settings.smtpEnabled ||
    !settings.smtpHost ||
    !settings.smtpUser ||
    !settings.smtpPassword ||
    !params.to
  ) {
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort ?? 587,
      secure: settings.smtpSecure,
      auth: { user: settings.smtpUser, pass: settings.smtpPassword },
    });

    const fromName = settings.smtpFromName || settings.siteName;
    const fromEmail = settings.smtpFromEmail || settings.smtpUser;

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
  } catch (error) {
    console.error("[mailer] Failed to send email:", error);
  }
}

/**
 * Sends a one-off test email using the currently saved SMTP settings and
 * surfaces the real success/failure back to the caller — unlike sendMail(),
 * which is intentionally silent so a broken SMTP config never breaks order
 * actions. Used by the admin "টেস্ট মেইল পাঠান" button so a misconfigured
 * host/port/credential shows up immediately instead of failing silently on
 * the next real customer email.
 */
export async function sendTestMail(to: string): Promise<{ success: true } | { success: false; error: string }> {
  const settings = await getSiteSettings();

  if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPassword) {
    return { success: false, error: "SMTP Host, User ও Password আগে সেভ করুন — তারপর টেস্ট করুন।" };
  }

  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort ?? 587,
    secure: settings.smtpSecure,
    auth: { user: settings.smtpUser, pass: settings.smtpPassword },
  });

  const fromName = settings.smtpFromName || settings.siteName;
  const fromEmail = settings.smtpFromEmail || settings.smtpUser;

  try {
    await transporter.verify();
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: `${settings.siteName} — টেস্ট ইমেইল`,
      html: emailShell(
        settings.siteName,
        `<p>প্রিয় অ্যাডমিন,</p>
         <p>এটি একটি টেস্ট ইমেইল। আপনার SMTP সেটিংস সঠিকভাবে কাজ করছে এবং ইমেইল পাঠানো যাচ্ছে।</p>`
      ),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: describeSmtpError(error) };
  }
}

function describeSmtpError(error: unknown): string {
  const code = (error as { code?: string } | null | undefined)?.code;
  const message = error instanceof Error ? error.message : String(error);

  switch (code) {
    case "EAUTH":
      return "SMTP লগইন ব্যর্থ হয়েছে — User বা Password ভুল আছে। (Gmail হলে App Password ব্যবহার করুন।)";
    case "ECONNECTION":
    case "ESOCKET":
      return "SMTP সার্ভারে সংযোগ করা যায়নি — Host ও Port ঠিক আছে কিনা যাচাই করুন।";
    case "ETIMEDOUT":
      return "SMTP সার্ভারে সংযোগে সময় শেষ হয়ে গেছে — Host/Port অথবা নেটওয়ার্ক ফায়ারওয়াল চেক করুন।";
    case "EENVELOPE":
      return "প্রাপকের ইমেইল ঠিকানাটি সার্ভার প্রত্যাখ্যান করেছে — ঠিকানাটি যাচাই করুন।";
    default:
      return `ইমেইল পাঠানো ব্যর্থ হয়েছে: ${message}`;
  }
}

// Convenience wrappers used by the order/wallet actions — resolve the
// current siteName for the template, then hand off to sendMail (which does
// its own smtpEnabled/credential check). `to` is typically order.user?.email,
// so accepting null/undefined here lets call sites skip guest-order checks.

export async function sendOrderDeliveredEmail(
  to: string | null | undefined,
  params: { orderNumber: string; amount: number }
) {
  if (!to) return;
  const settings = await getSiteSettings();
  const { subject, html } = orderDeliveredEmail({ siteName: settings.siteName, ...params });
  await sendMail({ to, subject, html });
}

export async function sendOrderCancelledEmail(
  to: string | null | undefined,
  params: { orderNumber: string; amount: number; refunded: boolean }
) {
  if (!to) return;
  const settings = await getSiteSettings();
  const { subject, html } = orderCancelledEmail({ siteName: settings.siteName, ...params });
  await sendMail({ to, subject, html });
}

export async function sendWalletTopupEmail(to: string | null | undefined, params: { amount: number }) {
  if (!to) return;
  const settings = await getSiteSettings();
  const { subject, html } = walletTopupEmail({ siteName: settings.siteName, ...params });
  await sendMail({ to, subject, html });
}

function emailShell(siteName: string, bodyHtml: string) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h2 style="color: #16a34a; margin-bottom: 16px;">${siteName}</h2>
      ${bodyHtml}
      <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">এটি একটি স্বয়ংক্রিয় ইমেইল, দয়া করে এই ইমেইলের উত্তর দেবেন না।</p>
    </div>
  `;
}

export function orderDeliveredEmail(params: { siteName: string; orderNumber: string; amount: number }) {
  return {
    subject: `আপনার অর্ডার ${params.orderNumber} ডেলিভার হয়েছে`,
    html: emailShell(
      params.siteName,
      `<p>প্রিয় গ্রাহক,</p>
       <p>আপনার অর্ডার <strong>${params.orderNumber}</strong> (৳${params.amount}) সফলভাবে ডেলিভার হয়েছে।</p>
       <p>আমাদের সাথে থাকার জন্য ধন্যবাদ।</p>`
    ),
  };
}

export function orderCancelledEmail(params: {
  siteName: string;
  orderNumber: string;
  amount: number;
  refunded: boolean;
}) {
  return {
    subject: `আপনার অর্ডার ${params.orderNumber} বাতিল হয়েছে`,
    html: emailShell(
      params.siteName,
      `<p>প্রিয় গ্রাহক,</p>
       <p>দুঃখিত, আপনার অর্ডার <strong>${params.orderNumber}</strong> (৳${params.amount}) বাতিল করা হয়েছে।</p>
       ${
         params.refunded
           ? `<p>৳${params.amount} আপনার ওয়ালেটে ফেরত (রিফান্ড) দেওয়া হয়েছে।</p>`
           : ""
       }
       <p>কোনো প্রশ্ন থাকলে আমাদের সাপোর্টে যোগাযোগ করুন।</p>`
    ),
  };
}

export function walletTopupEmail(params: { siteName: string; amount: number }) {
  return {
    subject: `আপনার ওয়ালেটে ৳${params.amount} যোগ হয়েছে`,
    html: emailShell(
      params.siteName,
      `<p>প্রিয় গ্রাহক,</p>
       <p>আপনার ওয়ালেটে <strong>৳${params.amount}</strong> সফলভাবে যোগ হয়েছে।</p>
       <p>আমাদের সাথে থাকার জন্য ধন্যবাদ।</p>`
    ),
  };
}
