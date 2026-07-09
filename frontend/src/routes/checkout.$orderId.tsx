import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import vbeeLogo from "@/assets/vbee-logo.png";
import { useAuth } from "@/context/AuthContext";
import {
  confirmDemoPayment,
  fetchBillingOrder,
  type BillingOrder,
} from "@/lib/billing";
import { formatQuotaTime } from "@/lib/quota";

export const Route = createFileRoute("/checkout/$orderId")({
  component: CheckoutPage,
});

function formatMoney(amount: number, currency = "VND") {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value?: string | null) {
  if (!value) return "Không có";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function CheckoutPage() {
  const { orderId } = Route.useParams();
  const { user, token, isLoading, updateUser } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<BillingOrder | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user || !token) {
      void navigate({
        to: "/login",
        search: { error: undefined, from: `/checkout/${orderId}` },
      });
      return;
    }

    let cancelled = false;
    setLoadingOrder(true);
    setError("");
    void fetchBillingOrder(token, orderId)
      .then((data) => {
        if (!cancelled) setOrder(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Không tải được đơn hàng",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingOrder(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoading, navigate, orderId, token, user]);

  async function handleConfirmPayment() {
    if (!token || !order) return;

    setConfirming(true);
    setError("");
    setMessage("");
    try {
      const result = await confirmDemoPayment(token, order.id);
      setOrder(result.order);
      updateUser({ plan: result.quota.plan });
      setMessage(
        `Thanh toán thành công. Tài khoản đã lên gói ${result.quota.label}, còn ${formatQuotaTime(
          result.quota.remainingSeconds,
        )} sử dụng.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không xác nhận được thanh toán",
      );
    } finally {
      setConfirming(false);
    }
  }

  const statusLabel =
    order?.status === "paid"
      ? "Đã thanh toán"
      : order?.status === "expired"
        ? "Đã hết hạn"
        : "Chờ thanh toán";

  return (
    <main className="min-h-screen bg-[#f4efe4] px-4 py-8 text-[#21104a] md:py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={vbeeLogo} alt="Vbee" className="h-12 w-auto" />
            <span className="text-sm font-black uppercase">AIVoice</span>
          </Link>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 rounded-full border border-[#e7d9c5] bg-white px-4 py-2 text-sm font-black text-[#21104a] shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Bảng giá
          </Link>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-[#eadfcf] bg-white shadow-[0_24px_80px_rgba(33,16,74,.12)]">
          <div className="bg-[#21104a] px-6 py-7 text-white md:px-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase text-[#ffcb05]">
              <ShieldCheck className="h-4 w-4" />
              Checkout bảo mật
            </div>
            <h1 className="mt-4 text-3xl font-black md:text-4xl">
              Thanh toán gói cước Vbee
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
              Bản demo này mô phỏng cổng thanh toán thật: backend tạo đơn hàng,
              sau đó chỉ kích hoạt quota khi thanh toán được xác nhận.
            </p>
          </div>

          <div className="grid gap-6 p-6 md:grid-cols-[1.05fr_.95fr] md:p-8">
            <div>
              {loadingOrder ? (
                <div className="rounded-2xl border border-[#eee8ff] bg-[#faf8ff] p-5 text-sm font-bold text-[#6a5a8f]">
                  Đang tải đơn hàng...
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
                  {error}
                </div>
              ) : order ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[#eee8ff] bg-[#faf8ff] p-5">
                    <p className="text-xs font-black uppercase text-[#6a5a8f]">
                      Mã đơn hàng
                    </p>
                    <p className="mt-1 break-all font-mono text-sm font-bold text-[#21104a]">
                      {order.id}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoTile
                      label="Gói cước"
                      value={order.label}
                      sub={
                        order.billingCycle === "yearly"
                          ? "Thanh toán năm"
                          : "Thanh toán tháng"
                      }
                    />
                    <InfoTile
                      label="Thời lượng"
                      value={formatQuotaTime(order.quotaSeconds)}
                      sub="Quota được cấp sau thanh toán"
                    />
                    <InfoTile
                      label="Trạng thái"
                      value={statusLabel}
                      sub={`Provider: ${order.provider}`}
                    />
                    <InfoTile
                      label="Hết hạn đơn"
                      value={formatDate(order.expiresAt)}
                      sub="Đơn pending sẽ hết hạn"
                    />
                  </div>

                  {message && (
                    <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-sm font-bold text-green-700">
                      {message}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <aside className="rounded-3xl border border-[#eee8ff] bg-[#fffdf4] p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ffcb05] text-[#21104a]">
                  <CircleDollarSign className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-[#7a6b1e]">
                    Tổng thanh toán
                  </p>
                  <p className="text-2xl font-black">
                    {order ? formatMoney(order.amount, order.currency) : "--"}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm font-semibold text-[#5f5278]">
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Kích hoạt quota sau khi backend xác nhận paid
                </p>
                <p className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-[#9a7b00]" />
                  Đơn hàng có thời hạn để tránh thanh toán treo
                </p>
                <p className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[#21104a]" />
                  Có thể thay demo bằng VNPay, MoMo, ZaloPay hoặc Stripe
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleConfirmPayment()}
                disabled={!order || order.status === "paid" || confirming}
                className="mt-7 w-full rounded-full bg-[#21104a] px-5 py-3 text-sm font-black text-white shadow-[0_18px_50px_rgba(33,16,74,.25)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {order?.status === "paid"
                  ? "Đã thanh toán"
                  : confirming
                    ? "Đang xác nhận..."
                    : "Thanh toán demo"}
              </button>

              {order?.status === "paid" && (
                <Link
                  to="/dashboard"
                  search={{ token: undefined }}
                  className="mt-3 block rounded-full border border-[#21104a]/20 bg-white px-5 py-3 text-center text-sm font-black text-[#21104a]"
                >
                  Về dashboard
                </Link>
              )}
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-[#eee8ff] bg-white p-4">
      <p className="text-xs font-black uppercase text-[#8b7aa6]">{label}</p>
      <p className="mt-1 text-lg font-black text-[#21104a]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[#7b6f93]">{sub}</p>
    </div>
  );
}
