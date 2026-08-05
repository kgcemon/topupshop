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
