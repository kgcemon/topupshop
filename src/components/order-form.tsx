"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { placeOrderAction, type OrderActionState } from "@/lib/actions/order-actions";
import { formatTaka, formatOrderNumber } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/status-badge";
import { PaymentNumberCard } from "@/components/payment-number-card";

type RechargeOption = { id: number; label: string; price: number; stock: number | null };

type PaymentNumbers = { bkashNumber: string; nagadNumber: string; rocketNumber: string };

type PaymentIcons = {
  bkashIcon: string | null;
  nagadIcon: string | null;
  rocketIcon: string | null;
  walletIcon: string | null;
};

const initialState: OrderActionState = {};

export function OrderForm({
  productId,
  options,
  isLoggedIn,
  walletBalance,
  paymentNumbers,
  paymentIcons,
  stockOut,
  allowGuestOrders,
}: {
  productId: number;
  options: RechargeOption[];
  isLoggedIn: boolean;
  walletBalance: number;
  paymentNumbers: PaymentNumbers;
  paymentIcons: PaymentIcons;
  stockOut: boolean;
  allowGuestOrders: boolean;
}) {
  const canOrderAsGuest = !isLoggedIn && allowGuestOrders;
  const [selectedOptionId, setSelectedOptionId] = useState<number | undefined>(undefined);
  const [method, setMethod] = useState<"WALLET" | "BKASH" | "NAGAD" | "ROCKET">(
    isLoggedIn ? "WALLET" : "BKASH"
  );
  const [state, formAction, pending] = useActionState(placeOrderAction, initialState);
  const pathname = usePathname();
  const loginHref = `/login?callbackUrl=${encodeURIComponent(pathname)}`;

  const selectedOption = options.find((o) => o.id === selectedOptionId);
  const price = selectedOption?.price ?? 0;
  const insufficientWallet = method === "WALLET" && walletBalance < price;
  const selectedOptionOutOfStock = selectedOption ? selectedOption.stock !== null && selectedOption.stock <= 0 : false;

  const receivingNumber =
    method === "BKASH"
      ? paymentNumbers.bkashNumber
      : method === "NAGAD"
        ? paymentNumbers.nagadNumber
        : method === "ROCKET"
          ? paymentNumbers.rocketNumber
          : null;

  const methodIcon =
    method === "BKASH"
      ? paymentIcons.bkashIcon
      : method === "NAGAD"
        ? paymentIcons.nagadIcon
        : method === "ROCKET"
          ? paymentIcons.rocketIcon
          : null;

  if (state.success && state.order) {
    const o = state.order;
    return (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center gap-3 bg-primary-50 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-primary-700">অর্ডারটি সফলভাবে সাবমিট হয়েছে!</p>
            <p className="text-xs text-gray-500">
              {o.paymentMethod === "WALLET"
                ? "আপনার ওয়ালেট থেকে টাকা কেটে নেওয়া হয়েছে। আমাদের টিম শীঘ্রই প্রসেস করবে।"
                : "আপনার পেমেন্ট রিভিউ করে অ্যাডমিন কর্তৃক অ্যাপ্রুভ করা হবে।"}
            </p>
          </div>
        </div>

        <div className="space-y-3 p-5 text-sm">
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5">
            <span className="text-xs text-gray-500">অর্ডার নাম্বার</span>
            <span className="font-mono text-sm font-bold tracking-wide text-secondary-900">{formatOrderNumber(o.orderSerial)}</span>
          </div>

          <DetailRow label="প্রোডাক্ট" value={`${o.productName} — ${o.optionLabel}`} />
          <DetailRow label="প্লেয়ার আইডি" value={o.playerId} />
          {o.playerName && <DetailRow label="প্লেয়ার নাম" value={o.playerName} />}
          <DetailRow label="পরিমাণ" value={`${formatTaka(o.amount)} টাকা`} />
          <DetailRow label="পেমেন্ট মেথড" value={o.paymentMethod} />
          {o.transactionId && <DetailRow label="ট্রানজেকশন আইডি" value={o.transactionId} mono />}
          <DetailRow
            label="সময়"
            value={new Date(o.createdAt).toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" })}
          />
          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <span className="text-xs text-gray-500">স্ট্যাটাস</span>
            <OrderStatusBadge status={o.status} />
          </div>
        </div>

        <div className="border-t border-gray-100 p-5">
          {isLoggedIn ? (
            <Link
              href="/dashboard/orders"
              className="block w-full rounded-md bg-primary-500 py-2.5 text-center font-bold text-white hover:bg-primary-600"
            >
              অর্ডার হিস্টোরি দেখুন
            </Link>
          ) : (
            <p className="rounded-md bg-gray-50 px-4 py-3 text-center text-xs text-gray-600">
              অর্ডার নাম্বারটি সংরক্ষণ করুন — স্ট্যাটাস জানতে WhatsApp সাপোর্টে যোগাযোগ করুন।
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rechargeOptionId" value={selectedOptionId} />
      <input type="hidden" name="paymentMethod" value={method} />

      <div className="space-y-6 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
        <div className="space-y-6 lg:col-span-2">
          {options.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-sm text-white">
                  1
                </span>
                Select Recharge
              </h2>
              <hr className="-mx-5 mb-4 border-t border-gray-200" />
              <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3">
                {options.map((option) => {
                  const outOfStock = option.stock !== null && option.stock <= 0;
                  return (
                    <label
                      key={option.id}
                      className={`flex min-h-[50px] items-center justify-between gap-1.5 rounded-lg border-2 p-2 text-[11px] font-semibold transition-colors sm:min-h-[56px] sm:gap-2 sm:p-3 sm:text-xs ${
                        outOfStock
                          ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
                          : "cursor-pointer " +
                            (option.id === selectedOptionId
                              ? "border-primary-500 bg-primary-50"
                              : "border-gray-200")
                      }`}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
                        <input
                          type="radio"
                          name="recharge-display"
                          className="shrink-0 accent-[#14D72B]"
                          checked={option.id === selectedOptionId}
                          disabled={outOfStock}
                          onChange={() => setSelectedOptionId(option.id)}
                        />
                        <span className="line-clamp-2 leading-tight">{option.label}</span>
                      </span>
                      <span className="shrink-0 whitespace-nowrap font-bold text-primary-600">
                        {outOfStock ? "Stock Out" : `${formatTaka(option.price)} TK`}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-sm text-white">
                2
              </span>
              Account Info
            </h2>
            <hr className="-mx-5 mb-4 border-t border-gray-200" />
            <label className="mb-1 block text-sm font-semibold" htmlFor="playerId">
              এখানে প্লেয়ার আইডি কোড দিন
            </label>
            <input
              id="playerId"
              name="playerId"
              required
              placeholder="এখানে প্লেয়ার আইডি কোড দিন"
              className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {state.fieldErrors?.playerId && (
              <p className="mb-3 -mt-2 text-sm text-red-600">{state.fieldErrors.playerId}</p>
            )}

            {canOrderAsGuest && (
              <>
                <p className="mb-3 rounded-md bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700">
                  গেস্ট হিসেবে অর্ডার করছেন। যোগাযোগের জন্য নাম ও ফোন নাম্বার দিন —{" "}
                  <Link href={loginHref} className="underline">
                    অথবা লগইন করুন
                  </Link>
                </p>
                <label className="mb-1 block text-sm font-semibold" htmlFor="guestName">
                  আপনার নাম
                </label>
                <input
                  id="guestName"
                  name="guestName"
                  required
                  placeholder="আপনার নাম লিখুন"
                  className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {state.fieldErrors?.guestName && (
                  <p className="mb-3 -mt-2 text-sm text-red-600">{state.fieldErrors.guestName}</p>
                )}
                <label className="mb-1 block text-sm font-semibold" htmlFor="guestPhone">
                  ফোন নাম্বার
                </label>
                <input
                  id="guestPhone"
                  name="guestPhone"
                  required
                  placeholder="01xxxxxxxxx"
                  className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {state.fieldErrors?.guestPhone && (
                  <p className="mb-3 -mt-2 text-sm text-red-600">{state.fieldErrors.guestPhone}</p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-sm text-white">
                3
              </span>
              Select one option
            </h2>
            <hr className="-mx-5 mb-4 border-t border-gray-200" />

            <div className={`mb-4 grid gap-3 ${isLoggedIn ? "grid-cols-2" : "grid-cols-1"}`}>
              {isLoggedIn && (
                <PayOption
                  active={method === "WALLET"}
                  icon={
                    paymentIcons.walletIcon ? (
                      <Image src={paymentIcons.walletIcon} alt="Wallet" width={20} height={20} unoptimized className="h-5 w-5 object-contain" />
                    ) : (
                      <WalletIcon />
                    )
                  }
                  title="uc ghor ওয়ালেট"
                  subtitle="Wallet Pay"
                  onClick={() => setMethod("WALLET")}
                />
              )}
              <PayOption
                active={method !== "WALLET"}
                icon={<MobileBankingIcon />}
                title="bKash / Nagad / Rocket"
                subtitle="Manual Pay"
                onClick={() => setMethod("BKASH")}
              />
            </div>

            {method === "WALLET" ? (
              <p className="mb-2 text-sm">
                আপনার ওয়ালেট ব্যালেন্স: <span className="font-bold">{formatTaka(walletBalance)} টাকা</span>
              </p>
            ) : (
              <div className="mb-4 space-y-3">
                <div className="flex gap-2">
                  {(["BKASH", "NAGAD", "ROCKET"] as const).map((m) => {
                    const icon =
                      m === "BKASH" ? paymentIcons.bkashIcon : m === "NAGAD" ? paymentIcons.nagadIcon : paymentIcons.rocketIcon;
                    return (
                      <button
                        type="button"
                        key={m}
                        onClick={() => setMethod(m)}
                        className={`flex flex-1 flex-col items-center gap-1 rounded-md border-2 py-2 text-xs font-bold ${
                          method === m ? "border-primary-500 bg-primary-50" : "border-gray-200"
                        }`}
                      >
                        {icon ? (
                          <Image src={icon} alt={m} width={24} height={24} unoptimized className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                          <span
                            className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
                            style={{ backgroundColor: METHOD_COLORS[m] }}
                          >
                            {m.charAt(0)}
                          </span>
                        )}
                        {m}
                      </button>
                    );
                  })}
                </div>
                {receivingNumber && (
                  <div>
                    <PaymentNumberCard
                      method={method}
                      number={receivingNumber}
                      icon={
                        methodIcon ? (
                          <Image src={methodIcon} alt={method} width={20} height={20} unoptimized className="h-5 w-5 shrink-0 rounded-full object-cover" />
                        ) : undefined
                      }
                    />
                    <p className="mt-1.5 text-xs text-gray-500">
                      উপরের নাম্বারে টাকা Send Money করে নিচে ট্রানজেকশন আইডি দিন।
                    </p>
                  </div>
                )}
                <input
                  name="transactionId"
                  placeholder="Transaction ID"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {state.fieldErrors?.transactionId && (
                  <p className="text-sm text-red-600">{state.fieldErrors.transactionId}</p>
                )}
              </div>
            )}

            <p className="mb-1 text-sm">
              প্রোডাক্ট কিনতে আপনার প্রয়োজন <span className="font-bold">{formatTaka(price)}</span> টাকা।
            </p>

            {stockOut && (
              <p className="mb-3 text-sm font-semibold text-red-600">
                এই প্রোডাক্টটি বর্তমানে Stock Out, এখন অর্ডার করা যাবে না।
              </p>
            )}
            {!isLoggedIn && !allowGuestOrders && (
              <p className="mb-3 text-sm font-semibold text-orange-500">Please Login To Purchase</p>
            )}
            {isLoggedIn && insufficientWallet && (
              <p className="mb-3 text-sm font-semibold text-orange-500">
                ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই।{" "}
                <Link href="/dashboard/deposit" className="underline">
                  টাকা যোগ করুন
                </Link>
              </p>
            )}
            {state.error && <p className="mb-3 text-sm text-red-600">{state.error}</p>}

            {isLoggedIn || allowGuestOrders ? (
              <button
                type="submit"
                disabled={pending || !selectedOptionId || insufficientWallet || stockOut || selectedOptionOutOfStock}
                className="block w-full rounded-md bg-primary-500 py-2 text-center font-bold text-white transition-colors hover:bg-primary-600 disabled:opacity-60"
              >
                {pending ? "প্রসেসিং..." : isLoggedIn ? "অর্ডার করুন" : "গেস্ট হিসেবে অর্ডার করুন"}
              </button>
            ) : (
              <Link
                href={loginHref}
                className="block w-full rounded-md bg-primary-500 py-2 text-center font-bold text-white transition-colors hover:bg-primary-600"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-right font-semibold ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function PayOption({
  active,
  icon,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center rounded-lg border-2 p-3 text-center transition-colors ${
        active ? "border-primary-500 bg-primary-50" : "border-gray-200"
      }`}
    >
      <span className={active ? "text-primary-600" : "text-gray-400"}>{icon}</span>
      <p className="mt-1.5 text-xs font-bold">{title}</p>
      <p className="mt-0.5 text-[10px] text-gray-500">{subtitle}</p>
    </button>
  );
}

const METHOD_COLORS: Record<"BKASH" | "NAGAD" | "ROCKET", string> = {
  BKASH: "#E2136E",
  NAGAD: "#F42534",
  ROCKET: "#8C3494",
};

function WalletIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1" />
      <rect x="2" y="7" width="20" height="12" rx="2" />
      <circle cx="17" cy="13" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MobileBankingIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <rect x="6" y="2" width="12" height="20" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" d="M10 18h4" />
    </svg>
  );
}
