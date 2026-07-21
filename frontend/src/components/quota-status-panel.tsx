import { useEffect, useState } from "react";
import { ArrowRight, Clock3, Crown, Save } from "lucide-react";
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
  variant = "default",
  showAlert = true,
  refreshKey = 0,
  onQuotaChange,
}: {
  compact?: boolean;
  variant?: "default" | "account";
  showAlert?: boolean;
  refreshKey?: number;
  onQuotaChange?: (quota: QuotaStatus) => void;
}) {
  const { token } = useAuth();
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [alertMinutes, setAlertMinutes] = useState(1);
  const [savingAlert, setSavingAlert] = useState(false);

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

  async function handleSaveAlert() {
    if (!token) return;
    const minutes = Math.round(Number(alertMinutes));
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 10_080) {
      setMessage("Mức cảnh báo cần từ 1 đến 10.080 phút.");
      return;
    }

    setSavingAlert(true);
    setMessage("");
    try {
      const updatedQuota = await saveQuotaAlert(token, minutes);
      setQuota(updatedQuota);
      setAlertMinutes(Math.max(1, Math.round(updatedQuota.alertSeconds / 60)));
      onQuotaChange?.(updatedQuota);
      setMessage("Đã lưu mức cảnh báo quota.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không lưu được cảnh báo",
      );
    } finally {
      setSavingAlert(false);
    }
  }

  if (!quota) {
    return (
      <div className="rounded-md border border-[#e8decc] bg-white p-3 text-sm text-[#756894]">
        Đang tải quota...
      </div>
    );
  }

  const isPaid = quota.plan !== "free";

  if (variant === "account") {
    return (
      <div className={`rounded-lg border border-[#e8decc] bg-white text-[#21104a] ${compact ? "p-3" : "p-4"}`}>
        <span className={`inline-flex items-center gap-2 rounded-full border border-[#ffcb05]/45 bg-[#fff8d7] font-black ${compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"}`}>
          <Crown className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          {quota.label}
        </span>

        <h3 className={`font-black leading-none ${compact ? "mt-3 text-xl" : "mt-4 text-2xl"}`}>
          {formatQuotaTime(quota.remainingSeconds)} còn lại
        </h3>
        <p className={`mt-1 font-semibold text-[#756894] ${compact ? "text-xs" : "text-sm"}`}>
          Đã dùng {formatQuotaTime(quota.usedSeconds)} /{" "}
          {formatQuotaTime(quota.quotaSeconds)}
        </p>
        <div className={`${compact ? "mt-3 h-1.5" : "mt-4 h-2"} overflow-hidden rounded-full bg-[#ece6ff]`}>
          <div
            className={`h-full rounded-full ${quota.isLimitReached ? "bg-destructive" : "bg-[#ffcb05]"}`}
            style={{ width: `${quota.percentUsed}%` }}
          />
        </div>

        {showAlert && (
          <label className="mt-4 block text-sm font-bold text-[#756894]">
            Alert khi còn dưới X phút
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_104px] gap-2">
              <input
                type="number"
                min="1"
                max="10080"
                value={alertMinutes}
                onChange={(event) => setAlertMinutes(Number(event.target.value))}
                className="h-12 w-full rounded-lg border border-[#e8decc] bg-white px-4 text-lg font-black text-[#21104a] outline-none transition focus:border-[#ffcb05]"
                aria-label="Cảnh báo quota còn lại theo phút"
              />
              <button
                type="button"
                onClick={() => void handleSaveAlert()}
                disabled={savingAlert}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-[#e8decc] bg-white px-3 text-sm font-black text-[#21104a] transition hover:border-[#ffcb05] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {savingAlert ? "Lưu..." : "Lưu"}
              </button>
            </div>
          </label>
        )}

        <div className={`grid grid-cols-3 border-t border-[#eee7da] font-semibold text-[#756894] ${compact ? "mt-3 gap-2 pt-3 text-xs leading-4" : "mt-4 gap-3 pt-4 text-sm leading-5"}`}>
          <span>
            Tải lên:
            <br />
            {quota.limits.maxUploadMb}MB
          </span>
          <span>
            Ghi âm: {formatQuotaTime(quota.limits.maxRecordSeconds)}
          </span>
          <span>
            File: {formatQuotaTime(quota.limits.maxFileSeconds)}
          </span>
        </div>

        {message && (
          <p className="mt-3 text-xs font-bold text-[#756894]">{message}</p>
        )}
      </div>
    );
  }

  const usageSummary = (
    <div className={`rounded-lg bg-[#fbf8ef] text-[#21104a] ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-center justify-between gap-3">
        <p className={`inline-flex items-center gap-2 font-black ${compact ? "text-xs" : "text-sm"}`}>
          <Clock3 className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          Thời gian sử dụng
          <ArrowRight className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </p>
        {!compact && (
          <span className="rounded-full border border-[#ffcb05]/35 bg-[#fff8cc] px-2.5 py-1 text-[11px] font-bold">
            {quota.label}
          </span>
        )}
      </div>
      <h3 className={`font-black leading-none ${compact ? "mt-2.5 text-xl" : "mt-3 text-2xl"}`}>
        {formatQuotaTime(quota.remainingSeconds)} còn lại
      </h3>
      <p className={`mt-1 font-semibold text-[#756894] ${compact ? "text-xs" : "text-sm"}`}>
        Đã dùng {formatQuotaTime(quota.usedSeconds)} /{" "}
        {formatQuotaTime(quota.quotaSeconds)}
      </p>
      <div className={`${compact ? "mt-3 h-1.5" : "mt-4 h-2"} overflow-hidden rounded-full bg-white`}>
        <div
          className={`h-full rounded-full ${quota.isLimitReached ? "bg-destructive" : "bg-[#ffcb05]"}`}
          style={{ width: `${quota.percentUsed}%` }}
        />
      </div>
    </div>
  );

  if (compact) return usageSummary;

  return (
    <div className="rounded-lg border border-[#e8decc] bg-white p-3 text-[#21104a] shadow-[0_6px_18px_rgba(33,16,74,.045)]">
      {usageSummary}

      <div className="mt-3 grid gap-2 text-xs text-[#756894] sm:grid-cols-3">
        <span>Tải lên: {quota.limits.maxUploadMb}MB</span>
        <span>Ghi âm: {formatQuotaTime(quota.limits.maxRecordSeconds)}</span>
        <span>File: {formatQuotaTime(quota.limits.maxFileSeconds)}</span>
      </div>

      {!isPaid && (
        <button
          onClick={() => void handleUpgrade()}
          disabled={busy}
          className="mt-3 rounded-full bg-[#ffcb05] px-3 py-1.5 text-xs font-bold text-[#21104a] transition hover:bg-[#ffdc45] disabled:opacity-60"
        >
          Nâng cấp gói
        </button>
      )}

      {message && (
        <p className="mt-3 text-xs font-bold text-[#21104a]">{message}</p>
      )}
    </div>
  );
}
