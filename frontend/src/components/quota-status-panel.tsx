import { useEffect, useState } from "react";
import { AlertTriangle, Crown, Save, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createCheckout } from "@/lib/billing";
import {
  fetchQuota,
  formatQuotaTime,
  saveQuotaAlert,
  type QuotaStatus,
} from "@/lib/quota";

export function QuotaStatusPanel({
  compact = false,
  refreshKey = 0,
  onQuotaChange,
}: {
  compact?: boolean;
  refreshKey?: number;
  onQuotaChange?: (quota: QuotaStatus) => void;
}) {
  const { token } = useAuth();
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [alertMinutes, setAlertMinutes] = useState(5);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadQuota() {
    if (!token) return;
    try {
      const data = await fetchQuota(token);
      setQuota(data);
      setAlertMinutes(Math.max(1, Math.round(data.alertSeconds / 60)));
      onQuotaChange?.(data);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không tải được quota",
      );
    }
  }

  useEffect(() => {
    void loadQuota();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, refreshKey]);

  async function handleSaveAlert() {
    if (!token) return;
    setBusy(true);
    setMessage("");
    try {
      const data = await saveQuotaAlert(token, alertMinutes);
      setQuota(data);
      onQuotaChange?.(data);
      setMessage("Đã lưu mức cảnh báo quota");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không lưu được cảnh báo",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleUpgrade() {
    if (!token) return;
    setBusy(true);
    setMessage("");
    try {
      const checkout = await createCheckout(token, "special", "monthly");
      window.location.assign(`/checkout/${checkout.order.id}`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không tạo được đơn hàng",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!quota) {
    return (
      <div className="rounded-2xl border border-border bg-card/75 p-4 text-sm text-muted-foreground">
        Đang tải quota...
      </div>
    );
  }

  const isPaid = quota.plan !== "free";

  return (
    <div className="rounded-2xl border border-border bg-card/85 p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-black text-primary">
            {isPaid ? (
              <Crown className="h-3.5 w-3.5" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
            {quota.label}
          </div>
          <h3 className="mt-3 text-lg font-black">
            {formatQuotaTime(quota.remainingSeconds)} còn lại
          </h3>
          <p className="text-sm text-muted-foreground">
            Đã dùng {formatQuotaTime(quota.usedSeconds)} /{" "}
            {formatQuotaTime(quota.quotaSeconds)}
          </p>
        </div>
        {!isPaid && (
          <button
            onClick={() => void handleUpgrade()}
            disabled={busy}
            className="rounded-full bg-primary px-4 py-2 text-xs font-black text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-60"
          >
            Nâng cấp
          </button>
        )}
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-background">
        <div
          className={`h-full rounded-full ${quota.isLimitReached ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${quota.percentUsed}%` }}
        />
      </div>

      {(quota.shouldAlert || quota.isLimitReached) && (
        <div className="mt-4 flex gap-2 rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs font-bold text-primary">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {quota.isLimitReached
            ? "Gói hiện tại đã hết thời lượng. Cần mua hoặc nâng cấp gói để tiếp tục."
            : `Quota sắp hết: còn dưới ${Math.round(quota.alertSeconds / 60)} phút.`}
        </div>
      )}

      {!compact && (
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="text-xs font-bold text-muted-foreground">
            Alert khi còn dưới X phút
            <input
              type="number"
              min={1}
              max={1440}
              value={alertMinutes}
              onChange={(e) => setAlertMinutes(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>
          <button
            onClick={() => void handleSaveAlert()}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 self-end rounded-xl border border-border px-4 py-2 text-sm font-black transition hover:border-primary/50 hover:text-primary disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            Lưu
          </button>
        </div>
      )}

      <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <span>Upload: {quota.limits.maxUploadMb}MB</span>
        <span>Ghi âm: {formatQuotaTime(quota.limits.maxRecordSeconds)}</span>
        <span>File: {formatQuotaTime(quota.limits.maxFileSeconds)}</span>
      </div>

      {message && (
        <p className="mt-3 text-xs font-bold text-primary">{message}</p>
      )}
    </div>
  );
}
