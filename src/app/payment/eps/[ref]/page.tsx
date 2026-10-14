import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/data";
import { describeEpsPayment } from "@/lib/eps-payments";
import { EpsPaymentStatus } from "@/components/eps-payment-status";

export const metadata: Metadata = {
  title: "Payment Status",
  robots: { index: false, follow: false },
};

// Where every EPS return URL ends up (via /api/eps/return). Public on purpose:
// the customer may come back with their login session expired, and this page
// must still tell them what happened to their money instead of a login wall
// or a 404. The unguessable ref is the only key.
export default async function EpsPaymentStatusPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const [payment, settings] = await Promise.all([
    /^[a-f0-9]{32}$/.test(ref)
      ? prisma.epsPayment.findUnique({
          where: { ref },
          include: {
            order: { select: { orderSerial: true } },
          },
        })
      : null,
    getSiteSettings(),
  ]);

  let product: { name: string; label: string; href: string } | null = null;
  if (payment?.rechargeOptionId) {
    const option = await prisma.rechargeOption.findUnique({
      where: { id: payment.rechargeOptionId },
      select: { label: true, product: { select: { id: true, name: true, slug: true } } },
    });
    if (option) {
      product = {
        name: option.product.name,
        label: option.label,
        href: `/topup/${option.product.id}/${option.product.slug}`,
      };
    }
  }

  return (
    <div className="container mx-auto max-w-lg px-4 py-10">
      <EpsPaymentStatus
        refId={ref}
        found={!!payment}
        purpose={payment?.purpose ?? "ORDER"}
        isGuest={!payment?.userId}
        amount={payment?.paidAmount ?? payment?.amount ?? 0}
        merchantTransactionId={payment?.merchantTransactionId ?? null}
        financialEntity={payment?.financialEntity ?? null}
        product={product}
        whatsappNumber={settings.whatsappNumber}
        initial={
          payment
            ? {
                status: payment.status,
                ...describeEpsPayment(payment),
                orderSerial: payment.order?.orderSerial ?? null,
              }
            : null
        }
      />
    </div>
  );
}
