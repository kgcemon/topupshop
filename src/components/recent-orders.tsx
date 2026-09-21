import Image from "next/image";
import { getRecentPublicOrders } from "@/lib/data";
import { formatTaka } from "@/lib/utils";
import { RecentOrdersRefresh } from "@/components/recent-orders-refresh";

const AVATAR_TONES = ["tone-emerald", "tone-sky", "tone-amber", "tone-rose", "tone-violet", "tone-slate"];

// Public feed collapses the internal statuses into three customer-facing ones.
const STATUS_PILL: Record<string, { className: string; icon: string; label: string }> = {
  DELIVERED: { className: "is-complete", icon: "✓", label: "Done" },
  PENDING: { className: "is-pending", icon: "•", label: "Pending" },
  APPROVED: { className: "is-progress", icon: "↻", label: "Processing" },
  RUNNING: { className: "is-progress", icon: "↻", label: "Processing" },
};

export async function RecentOrders() {
  const orders = await getRecentPublicOrders(10);
  if (orders.length === 0) return null;

  return (
    <section className="latest-orders-section container mx-auto py-4 md:py-8">
      <div className="latest-orders-card">
        <div className="latest-orders-header">
          <div className="latest-orders-title-wrap">
            <div className="latest-orders-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M7.5 8.5V7a4.5 4.5 0 0 1 9 0v1.5M5.75 8.5h12.5a1.75 1.75 0 0 1 1.74 1.9l-.75 8.5a2.25 2.25 0 0 1-2.24 2.1H7a2.25 2.25 0 0 1-2.24-2.1l-.75-8.5a1.75 1.75 0 0 1 1.74-1.9ZM9.5 13l2 2 4-4"
                />
              </svg>
            </div>
            <div>
              <h3>Recent Orders</h3>
              <div className="latest-orders-live">
                <span className="live-dot" aria-hidden="true" />
                <span>Live</span>
                <svg viewBox="0 0 44 18" aria-hidden="true">
                  <path
                    d="M1 9h7l3-7 6 15 4-8h7l3-6 4 12 3-6h5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </div>
            </div>
          </div>
          <div className="latest-orders-actions">
            <RecentOrdersRefresh />
          </div>
        </div>

        <div className="latest-orders-list">
          {orders.map((order, index) => {
            const name = order.user?.name?.trim() || order.guestName?.trim() || "Guest";
            const photo = order.user?.image ?? null;
            const pill = STATUS_PILL[order.status] ?? STATUS_PILL.PENDING;

            return (
              <article
                key={order.id}
                className="latest-order-row without-time"
                style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
              >
                <div className="latest-order-customer">
                  <div className={`latest-order-avatar ${AVATAR_TONES[index % AVATAR_TONES.length]} ${photo ? "has-photo" : ""}`}>
                    <span className="latest-order-initial" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                          d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0"
                        />
                      </svg>
                    </span>
                    {photo && <Image src={photo} alt="" width={48} height={48} unoptimized />}
                  </div>
                  <div className="latest-order-copy">
                    <h4>{name}</h4>
                    <p>
                      <span>{order.rechargeOption.label}</span>
                      <span className="latest-order-price"> - ৳{formatTaka(order.amount)}</span>
                    </p>
                  </div>
                </div>
                <div className="latest-order-status">
                  <span className={`latest-status-pill ${pill.className}`}>
                    <span className="latest-status-icon">{pill.icon}</span> {pill.label}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
