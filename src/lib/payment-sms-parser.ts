import type { PaymentMethod } from "@/generated/prisma/enums";

export type ParsedPaymentSms = {
  amount: string;
  paymentNumber: string;
  trxId: string;
  balance?: string;
};

function stripCommas(value: string) {
  return value.replace(/,/g, "");
}

// Pulls the sender's own account balance out of the SMS, independent of
// where it falls relative to the amount/trxId (bKash/Rocket put it after,
// Nagad's format is captured inline in its own pattern below instead).
// Returns undefined when the message doesn't include a balance line at all.
function extractBalance(sms: string, pattern: RegExp): string | undefined {
  const m = sms.match(pattern);
  return m ? stripCommas(m[1]) : undefined;
}

// Mirrors the regex patterns from the legacy PHP webhook (bKash/Nagad/Rocket
// SMS formats). Returns null when `sms` isn't a recognized payment
// notification for the given method (e.g. a promo/OTP text from the same
// sender) — those are acknowledged by the API but not stored.
export function parsePaymentSms(method: PaymentMethod, sms: string): ParsedPaymentSms | null {
  if (method === "BKASH") {
    const balance = extractBalance(sms, /Balance Tk\s*([\d,]+\.\d{2})/);

    let m = sms.match(/You have received Tk ([\d,]+(?:\.\d{2})?) from (\d+).* TrxID (\w+)/);
    if (m) return { amount: stripCommas(m[1]), paymentNumber: m[2], trxId: m[3], balance };

    m = sms.match(/Cash In Tk ([\d,]+(?:\.\d{2})?) from (\d+).* TrxID (\w+)/);
    if (m) return { amount: stripCommas(m[1]), paymentNumber: m[2], trxId: m[3], balance };

    return null;
  }

  if (method === "NAGAD") {
    let m = sms.match(
      /Amount: Tk ([\d,]+(?:\.\d{2})?)[\s\S]*Sender: (\d+)[\s\S]*TxnID: (\w+)[\s\S]*Balance: Tk ([\d,]+\.\d{2})/
    );
    if (!m) {
      m = sms.match(
        /Amount: Tk ([\d,]+(?:\.\d{2})?)[\s\S]*Uddokta: (\d+)[\s\S]*TxnID: (\w+)[\s\S]*Balance: ([\d,]+\.\d{2})/
      );
    }
    if (m) return { amount: stripCommas(m[1]), paymentNumber: m[2], trxId: m[3], balance: stripCommas(m[4]) };

    return null;
  }

  if (method === "ROCKET") {
    const m = sms.match(/Tk([\d,]+(?:\.\d{2})?) received from A\/C:\*+(\d+).*TxnId:(\d+)/);
    if (m) {
      const balance = extractBalance(sms, /Your A\/C Balance: Tk([\d,]+\.\d{2})/);
      return { amount: stripCommas(m[1]), paymentNumber: m[2], trxId: m[3], balance };
    }

    return null;
  }

  return null;
}
