import type { DeliveryMethod } from "@/generated/prisma/client";
import { fulfillUnipinOrder } from "@/lib/unipin-fulfillment";
import { fulfillShellOrder } from "@/lib/shell-fulfillment";

export type FulfillmentResult =
  | { status: "already-fulfilled" }
  | { status: "not-applicable" }
  | { status: "fulfilled" }
  | { status: "insufficient" }
  | { status: "failed"; error?: string };

// Single dispatch point for order fulfillment — routes to the delivery
// method's own isolated pipeline. UniPin and Shell never see each other's
// config or resources; MANUAL is a deliberate no-op (admin fulfills by hand).
export async function fulfillOrder(orderId: string, deliveryMethod: DeliveryMethod): Promise<FulfillmentResult> {
  if (deliveryMethod === "UNIPIN") return fulfillUnipinOrder(orderId);
  if (deliveryMethod === "SHELL") return fulfillShellOrder(orderId);
  return { status: "not-applicable" };
}
