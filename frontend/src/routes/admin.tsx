import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  CheckCheck,
  CircleDollarSign,
  Headphones,
  ListChecks,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { AuthenticatedHeader } from "@/components/auth-app-header";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:3001";

type AdminRole = "support" | "finance" | "admin" | "super_admin";
type TabCode =
  | "overview"
  | "quotaAlerts"
  | "users"
  | "orders"
  | "jobs"
  | "support"
  | "audit";

type Summary = {
  users: { total: number; active: number; new_30d: number; paid_plan: number };
  jobs: {
    total: number;
    queued: number;
    processing: number;
    failed: number;
    completed: number;
  } | null;
  billing: {
    revenue: string | number;
    paid_orders: number;
    pending_orders: number;
  } | null;
  usage: { processed_seconds: number; completed_transcripts: number } | null;
  support: { open_tickets: number } | null;
  quotaAlerts: { active: number; unread: number; exhausted: number };
  providers: Array<{
    code: string;
    name: string;
    configured: boolean;
    active: boolean;
    inFallbackChain: boolean;
    priority: number | null;
    circuitState: "closed" | "open" | "half_open";
    openUntil: string | null;
    consecutiveFailures: number;
    lastErrorCode: string | null;
    lastFailureAt: string | null;
    lastSuccessAt: string | null;
  }>;
  generatedAt: string;
};

type AdminUser = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  plan: string;
  quota_seconds: number;
  quota_alert_seconds: number;
  role: string;
  account_status: string;
  admin_note: string | null;
  used_seconds: number;
  top_up_remaining_seconds: number;
  transcription_count: number;
  created_at: string;
};

type Order = {
  id: string;
  product_type: string;
  product_code: string;
  plan: string;
  billing_cycle: string;
  amount: number;
  currency: string;
  status: string;
  payment_code: string | null;
  created_at: string;
  paid_at: string | null;
  email: string;
  user_name: string;
};

type Job = {
  id: number;
  status: string;
  progress: number;
  source: string;
  language: string;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  created_at: string;
  filename: string;
  email: string;
  plan: string;
};

type Ticket = {
  id: number;
  subject: string;
  category: string;
  priority: string;
  status: string;
  email: string;
  name: string;
  user_plan: string;
  message_count: number;
  created_at: string;
};

type AuditLog = {
  id: number;
  action: string;
  target_type: string;
  target_id: string | null;
  reason: string;
  request_id: string | null;
  created_at: string;
  actor_email: string | null;
  actor_name: string | null;
};

type QuotaAlert = {
  id: number;
  user_id: number;
  user_name: string;
  email: string;
  plan: string;
  level: "warning" | "critical" | "exhausted";
  status: "open" | "acknowledged" | "resolved";
  quota_seconds: number;
  used_seconds: number;
  remaining_seconds: number;
  percent_remaining: number;
  threshold_percent: number;
  source: string;
  email_status: string;
  email_attempts: number;
  email_sent_at: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
};

const TAB_LABELS: Record<TabCode, string> = {
  overview: "Tổng quan",
  quotaAlerts: "Cảnh báo quota",
  users: "Người dùng",
  orders: "Thanh toán",
  jobs: "Job xử lý",
  support: "Hỗ trợ",
  audit: "Nhật ký",
};

const ROLE_LABELS: Record<string, string> = {
  user: "Người dùng",
  support: "Hỗ trợ",
  finance: "Tài chính",
  admin: "Quản trị",
  super_admin: "Super Admin",
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  standard: "Tiêu chuẩn",
  special: "Đặc biệt",
  business: "Chuyên nghiệp",
};

export const Route = createFileRoute("/admin")({ component: AdminPage });

function formatDate(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "-";
}

function formatDuration(seconds: number | string = 0) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatQuotaDuration(seconds: number | string = 0) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (total < 60) return `${total}s`;
  return formatDuration(total);
}

function formatMoney(amount: number | string, currency = "VND") {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency }).format(
    Number(amount) || 0,
  );
}

function statusClass(status: string) {
  if (["active", "paid", "completed", "resolved"].includes(status))
    return "bg-emerald-50 text-emerald-700";
  if (["failed", "blocked", "cancelled", "closed"].includes(status))
    return "bg-red-50 text-red-700";
  if (["queued", "pending", "open"].includes(status))
    return "bg-amber-50 text-amber-800";
  return "bg-[#f2eef8] text-[#65587c]";
}

function Badge({
  children,
  status,
}: {
  children: React.ReactNode;
  status: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${statusClass(status)}`}
    >
      {children}
    </span>
  );
}

function AdminPage() {
  const { user, token, isLoading } = useAuth();
  const navigate = useNavigate();
  const role = user?.role as AdminRole | undefined;
  const canAccess = Boolean(
    role && ["support", "finance", "admin", "super_admin"].includes(role),
  );
  const tabs = useMemo<TabCode[]>(() => {
    const result: TabCode[] = ["overview", "quotaAlerts"];
    if (role === "admin" || role === "super_admin") result.push("users");
    if (role === "finance" || role === "admin" || role === "super_admin")
      result.push("orders");
    if (role === "support" || role === "admin" || role === "super_admin")
      result.push("jobs", "support");
    if (role === "admin" || role === "super_admin") result.push("audit");
    return result;
  }, [role]);
  const [activeTab, setActiveTab] = useState<TabCode>("overview");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [quotaAlerts, setQuotaAlerts] = useState<QuotaAlert[]>([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      void navigate({ to: "/login", search: { from: "/admin" } });
    }
  }, [isLoading, navigate, user]);

  const api = useCallback(
    async <T,>(path: string, options?: RequestInit): Promise<T> => {
      const response = await fetch(`${API_URL}/api/admin${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });
      const data = (await response.json().catch(() => ({}))) as T & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error || "Yêu cầu quản trị thất bại");
      return data;
    },
    [token],
  );

  useEffect(() => {
    if (!token || !canAccess) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        if (activeTab === "overview")
          setSummary(await api<Summary>("/summary"));
        if (activeTab === "quotaAlerts") {
          const data = await api<{ alerts: QuotaAlert[] }>(
            `/quota-alerts?status=active&search=${encodeURIComponent(appliedSearch)}`,
          );
          if (!cancelled) setQuotaAlerts(data.alerts);
        }
        if (activeTab === "users") {
          const data = await api<{ users: AdminUser[] }>(
            `/users?search=${encodeURIComponent(appliedSearch)}`,
          );
          if (!cancelled) setUsers(data.users);
        }
        if (activeTab === "orders") {
          const data = await api<{ orders: Order[] }>(
            `/orders?search=${encodeURIComponent(appliedSearch)}`,
          );
          if (!cancelled) setOrders(data.orders);
        }
        if (activeTab === "jobs") {
          const data = await api<{ jobs: Job[] }>(
            `/jobs?search=${encodeURIComponent(appliedSearch)}`,
          );
          if (!cancelled) setJobs(data.jobs);
        }
        if (activeTab === "support") {
          const data = await api<{ tickets: Ticket[] }>("/support");
          if (!cancelled) setTickets(data.tickets);
        }
        if (activeTab === "audit") {
          const data = await api<{ logs: AuditLog[] }>("/audit");
          if (!cancelled) setAudit(data.logs);
        }
      } catch (loadError) {
        if (!cancelled)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Không tải được dữ liệu CMS",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeTab, api, appliedSearch, canAccess, reloadKey, token]);

  async function runJobAction(job: Job, action: "retry" | "cancel") {
    const reason = window.prompt(
      action === "retry" ? "Lý do chạy lại job:" : "Lý do hủy job:",
    );
    if (!reason) return;
    try {
      await api(`/jobs/${job.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setReloadKey((value) => value + 1);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Không cập nhật được job",
      );
    }
  }

  async function updateTicket(ticket: Ticket, status: string) {
    const reason = window.prompt("Lý do đổi trạng thái yêu cầu hỗ trợ:");
    if (!reason) return;
    try {
      await api(`/support/${ticket.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason }),
      });
      setReloadKey((value) => value + 1);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Không cập nhật được yêu cầu hỗ trợ",
      );
    }
  }

  async function updateQuotaAlert(
    alert: QuotaAlert,
    action: "acknowledge" | "resolve",
  ) {
    const reason =
      action === "resolve" ? window.prompt("Cách xử lý cảnh báo quota:") : null;
    if (action === "resolve" && !reason) return;
    try {
      await api(`/quota-alerts/${alert.id}/${action}`, {
        method: "PATCH",
        body: JSON.stringify(reason ? { reason } : {}),
      });
      setReloadKey((value) => value + 1);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Không cập nhật được cảnh báo quota",
      );
    }
  }

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[#65587c]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-[#fbfaf7] text-[#21104a]">
        <AuthenticatedHeader />
        <main className="mx-auto max-w-xl px-4 py-20 text-center">
          <ShieldCheck className="mx-auto mb-5 h-12 w-12 text-[#ffcb05]" />
          <h1 className="text-2xl font-bold">
            Bạn không có quyền truy cập CMS
          </h1>
          <p className="mt-3 text-sm text-[#756894]">
            Hãy liên hệ Super Admin để được cấp đúng vai trò quản trị.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f5fa] text-[#21104a]">
      <AuthenticatedHeader />
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#9a7b00]">
              Vbee CMS
            </p>
            <h1 className="mt-1 text-2xl font-bold">Trung tâm quản trị</h1>
            <p className="mt-1 text-sm text-[#756894]">
              Theo dõi vận hành, người dùng, thanh toán và hàng đợi xử lý.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#756894]">
            <ShieldCheck className="h-4 w-4 text-[#d69f00]" />
            {ROLE_LABELS[role || "user"]}
          </div>
        </div>

        <div className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-[#e5deef] bg-white p-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-bold transition ${activeTab === tab ? "bg-[#21104a] text-white" : "text-[#65587c] hover:bg-[#faf7ef]"}`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {activeTab !== "overview" &&
          activeTab !== "support" &&
          activeTab !== "audit" && (
            <form
              className="mb-4 flex max-w-lg gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setAppliedSearch(search.trim());
              }}
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8a7ba4]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm theo tên, email hoặc mã..."
                  className="h-9 w-full rounded-md border border-[#ddd5e8] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#21104a]"
                />
              </div>
              <button className="rounded-md bg-[#21104a] px-4 text-sm font-bold text-white">
                Tìm
              </button>
            </form>
          )}

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
        {loading && (
          <div className="flex min-h-52 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[#21104a]" />
          </div>
        )}
        {!loading && activeTab === "overview" && summary && (
          <Overview summary={summary} />
        )}
        {!loading && activeTab === "users" && (
          <UsersTable users={users} onEdit={setEditingUser} />
        )}
        {!loading && activeTab === "quotaAlerts" && (
          <QuotaAlertsTable alerts={quotaAlerts} onAction={updateQuotaAlert} />
        )}
        {!loading && activeTab === "orders" && <OrdersTable orders={orders} />}
        {!loading && activeTab === "jobs" && (
          <JobsTable jobs={jobs} onAction={runJobAction} />
        )}
        {!loading && activeTab === "support" && (
          <SupportTable tickets={tickets} onUpdate={updateTicket} />
        )}
        {!loading && activeTab === "audit" && <AuditTable logs={audit} />}
      </main>
      <EditUserDialog
        user={editingUser}
        isSuperAdmin={role === "super_admin"}
        onClose={() => setEditingUser(null)}
        onSave={async (payload) => {
          if (!editingUser) return;
          await api(`/users/${editingUser.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
          setEditingUser(null);
          setReloadKey((value) => value + 1);
        }}
      />
    </div>
  );
}

function Overview({ summary }: { summary: Summary }) {
  const metrics: Array<{
    label: string;
    value: string | number;
    detail: string;
    icon: typeof Users;
  }> = [
    {
      label: "Người dùng",
      value: summary.users.total,
      detail: `${summary.users.paid_plan} đang dùng gói trả phí`,
      icon: Users,
    },
  ];
  if (summary.billing)
    metrics.push({
      label: "Doanh thu đã thu",
      value: formatMoney(summary.billing.revenue),
      detail: `${summary.billing.pending_orders} đơn chờ thanh toán`,
      icon: CircleDollarSign,
    });
  if (summary.jobs)
    metrics.push({
      label: "Job đang chờ",
      value: summary.jobs.queued,
      detail: `${summary.jobs.processing} đang xử lý, ${summary.jobs.failed} lỗi`,
      icon: ListChecks,
    });
  if (summary.support)
    metrics.push({
      label: "Yêu cầu hỗ trợ",
      value: summary.support.open_tickets,
      detail: "Đang mở hoặc chờ phản hồi",
      icon: Headphones,
    });
  metrics.push({
    label: "Cảnh báo quota",
    value: summary.quotaAlerts.active,
    detail: `${summary.quotaAlerts.unread} chưa xem, ${summary.quotaAlerts.exhausted} đã hết quota`,
    icon: BellRing,
  });
  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(({ label, value, detail, icon: Icon }) => (
          <article
            key={label}
            className="rounded-lg border border-[#e4ddeb] bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase text-[#756894]">
                {label}
              </p>
              <Icon className="h-5 w-5 text-[#d69f00]" />
            </div>
            <p className="mt-3 text-2xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-[#756894]">{detail}</p>
          </article>
        ))}
      </section>
      {(summary.jobs || summary.providers.length > 0) && (
        <section className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
          {summary.jobs && (
            <article className="rounded-lg border border-[#e4ddeb] bg-white p-4">
              <h2 className="text-sm font-bold">Sức khỏe xử lý</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Hoàn tất", summary.jobs.completed],
                  ["Đang xử lý", summary.jobs.processing],
                  ["Đang chờ", summary.jobs.queued],
                  ["Thất bại", summary.jobs.failed],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-md bg-[#faf8f2] p-3"
                  >
                    <p className="text-xl font-bold">{value}</p>
                    <p className="text-xs text-[#756894]">{label}</p>
                  </div>
                ))}
              </div>
              {summary.usage && (
                <p className="mt-4 text-xs text-[#756894]">
                  Đã xử lý {formatDuration(summary.usage.processed_seconds)} từ{" "}
                  {summary.usage.completed_transcripts} transcript.
                </p>
              )}
            </article>
          )}
          {summary.providers.length > 0 && (
            <article className="rounded-lg border border-[#e4ddeb] bg-white p-4">
              <h2 className="text-sm font-bold">Nhà cung cấp API</h2>
              <div className="mt-3 space-y-2">
                {summary.providers.map((provider) => (
                  <div
                    key={provider.code}
                    className="flex items-center justify-between gap-3 rounded-md border border-[#eee8f3] px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="block font-semibold">
                        {provider.name}
                      </span>
                      {provider.lastErrorCode && (
                        <span className="mt-0.5 block text-[11px] text-[#766b91]">
                          Lỗi gần nhất: {provider.lastErrorCode}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-xs font-bold">
                      {provider.circuitState === "open" ? (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      ) : provider.circuitState === "half_open" ? (
                        <RefreshCw className="h-4 w-4 text-amber-600" />
                      ) : provider.configured ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                      )}
                      {provider.circuitState === "open"
                        ? "Tạm ngắt"
                        : provider.circuitState === "half_open"
                          ? "Đang thử lại"
                          : !provider.configured
                            ? "Chưa cấu hình"
                            : provider.priority === 1
                              ? "Ưu tiên 1"
                              : provider.priority
                                ? `Dự phòng ${provider.priority}`
                                : "Sẵn sàng"}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          )}
        </section>
      )}
    </div>
  );
}

function TableShell({
  headers,
  children,
  empty,
}: {
  headers: string[];
  children: React.ReactNode;
  empty: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#e4ddeb] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-[#faf8f2] text-xs uppercase text-[#756894]">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 font-bold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eee8f3]">{children}</tbody>
        </table>
      </div>
      {empty && (
        <p className="px-4 py-12 text-center text-sm text-[#756894]">
          Không có dữ liệu phù hợp.
        </p>
      )}
    </div>
  );
}

function QuotaAlertsTable({
  alerts,
  onAction,
}: {
  alerts: QuotaAlert[];
  onAction: (alert: QuotaAlert, action: "acknowledge" | "resolve") => void;
}) {
  const levelLabels = {
    warning: "Sắp hết",
    critical: "Khẩn cấp",
    exhausted: "Đã hết",
  };
  const levelClasses = {
    warning: "bg-amber-50 text-amber-800",
    critical: "bg-orange-50 text-orange-700",
    exhausted: "bg-red-50 text-red-700",
  };
  const emailLabels: Record<string, string> = {
    pending: "Chờ gửi",
    sending: "Đang gửi",
    sent: "Đã gửi",
    failed: "Gửi lỗi",
    skipped: "Đã bỏ qua",
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[#ead99d] bg-[#fff9df] px-4 py-3 text-sm text-[#5e4b00]">
        <p className="font-bold">Hộp thư cảnh báo dung lượng</p>
        <p className="mt-1 text-xs leading-5">
          Hệ thống tự tạo cảnh báo ở mức còn 20%, 5% và 0%. Mua thêm giờ hoặc
          bắt đầu chu kỳ mới sẽ tự đóng cảnh báo đang mở.
        </p>
      </div>
      <TableShell
        headers={[
          "Khách hàng",
          "Mức cảnh báo",
          "Gói",
          "Dung lượng",
          "Email",
          "Phát hiện",
          "Thao tác",
        ]}
        empty={!alerts.length}
      >
        {alerts.map((item) => (
          <tr
            key={item.id}
            className={item.status === "open" ? "bg-[#fffdf5]" : ""}
          >
            <td className="px-4 py-3">
              <div className="flex items-start gap-2">
                {item.status === "open" && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#ffcb05]" />
                )}
                <span>
                  <span className="block font-bold">
                    {item.user_name || `User #${item.user_id}`}
                  </span>
                  <span className="block text-xs text-[#756894]">
                    {item.email}
                  </span>
                </span>
              </div>
            </td>
            <td className="px-4 py-3">
              <span
                className={`inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${levelClasses[item.level]}`}
              >
                {levelLabels[item.level]}
              </span>
              <p className="mt-1 text-[11px] text-[#756894]">
                {Number(item.percent_remaining || 0).toFixed(1)}% còn lại
              </p>
            </td>
            <td className="px-4 py-3">{PLAN_LABELS[item.plan] || item.plan}</td>
            <td className="px-4 py-3">
              <p className="font-bold">
                Còn {formatQuotaDuration(item.remaining_seconds)}
              </p>
              <p className="text-xs text-[#756894]">
                Đã dùng {formatQuotaDuration(item.used_seconds)} /{" "}
                {formatQuotaDuration(item.quota_seconds)}
              </p>
            </td>
            <td className="px-4 py-3">
              <p className="text-xs font-semibold">
                {emailLabels[item.email_status] || item.email_status}
              </p>
              {item.email_sent_at && (
                <p className="text-[11px] text-[#756894]">
                  {formatDate(item.email_sent_at)}
                </p>
              )}
            </td>
            <td className="px-4 py-3">
              <p className="text-xs">{formatDate(item.created_at)}</p>
              <p className="text-[11px] text-[#756894]">{item.source}</p>
            </td>
            <td className="px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {item.status === "open" && (
                  <button
                    onClick={() => onAction(item, "acknowledge")}
                    className="rounded-md border border-[#dcd3e8] px-2.5 py-1.5 text-xs font-bold hover:bg-[#faf8f2]"
                  >
                    <CheckCheck className="mr-1 inline h-3.5 w-3.5" />
                    Đã xem
                  </button>
                )}
                <button
                  onClick={() => onAction(item, "resolve")}
                  className="rounded-md bg-[#21104a] px-2.5 py-1.5 text-xs font-bold text-white"
                >
                  Xử lý xong
                </button>
              </div>
            </td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}

function UsersTable({
  users,
  onEdit,
}: {
  users: AdminUser[];
  onEdit: (user: AdminUser) => void;
}) {
  return (
    <TableShell
      headers={[
        "Người dùng",
        "Gói",
        "Quota",
        "Vai trò",
        "Trạng thái",
        "Transcript",
        "",
      ]}
      empty={!users.length}
    >
      {users.map((item) => (
        <tr key={item.id}>
          <td className="px-4 py-3">
            <p className="font-bold">
              {item.first_name} {item.last_name}
            </p>
            <p className="text-xs text-[#756894]">{item.email}</p>
          </td>
          <td className="px-4 py-3">{PLAN_LABELS[item.plan] || item.plan}</td>
          <td className="px-4 py-3">
            <p>
              {formatDuration(item.used_seconds)} /{" "}
              {formatDuration(item.quota_seconds)}
            </p>
            <p className="text-xs text-[#756894]">
              Mua thêm: {formatDuration(item.top_up_remaining_seconds)}
            </p>
          </td>
          <td className="px-4 py-3">{ROLE_LABELS[item.role] || item.role}</td>
          <td className="px-4 py-3">
            <Badge status={item.account_status}>
              {item.account_status === "active" ? "Hoạt động" : "Đã khóa"}
            </Badge>
          </td>
          <td className="px-4 py-3">{item.transcription_count}</td>
          <td className="px-4 py-3 text-right">
            <button
              onClick={() => onEdit(item)}
              className="rounded-md border border-[#dcd3e8] px-3 py-1.5 text-xs font-bold hover:bg-[#faf8f2]"
            >
              Chỉnh sửa
            </button>
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

function OrdersTable({ orders }: { orders: Order[] }) {
  return (
    <TableShell
      headers={[
        "Mã đơn",
        "Khách hàng",
        "Sản phẩm",
        "Số tiền",
        "Trạng thái",
        "Tạo lúc",
        "Thanh toán",
      ]}
      empty={!orders.length}
    >
      {orders.map((item) => (
        <tr key={item.id}>
          <td className="px-4 py-3 font-mono text-xs">
            {item.payment_code || item.id}
          </td>
          <td className="px-4 py-3">
            <p className="font-bold">{item.user_name}</p>
            <p className="text-xs text-[#756894]">{item.email}</p>
          </td>
          <td className="px-4 py-3">{item.product_code || item.plan}</td>
          <td className="px-4 py-3 font-bold">
            {formatMoney(item.amount, item.currency)}
          </td>
          <td className="px-4 py-3">
            <Badge status={item.status}>{item.status}</Badge>
          </td>
          <td className="px-4 py-3">{formatDate(item.created_at)}</td>
          <td className="px-4 py-3">{formatDate(item.paid_at)}</td>
        </tr>
      ))}
    </TableShell>
  );
}

function JobsTable({
  jobs,
  onAction,
}: {
  jobs: Job[];
  onAction: (job: Job, action: "retry" | "cancel") => void;
}) {
  return (
    <TableShell
      headers={[
        "Tệp",
        "Người dùng",
        "Gói",
        "Trạng thái",
        "Tiến độ",
        "Lần thử",
        "Tạo lúc",
        "Thao tác",
      ]}
      empty={!jobs.length}
    >
      {jobs.map((item) => (
        <tr key={item.id}>
          <td className="max-w-56 px-4 py-3">
            <p className="truncate font-bold">{item.filename}</p>
            <p className="truncate text-xs text-red-600">
              {item.error_message}
            </p>
          </td>
          <td className="px-4 py-3 text-xs">{item.email}</td>
          <td className="px-4 py-3">{PLAN_LABELS[item.plan] || item.plan}</td>
          <td className="px-4 py-3">
            <Badge status={item.status}>{item.status}</Badge>
          </td>
          <td className="px-4 py-3">{item.progress || 0}%</td>
          <td className="px-4 py-3">
            {item.attempts}/{item.max_attempts}
          </td>
          <td className="px-4 py-3">{formatDate(item.created_at)}</td>
          <td className="px-4 py-3">
            <div className="flex gap-2">
              {["failed", "cancelled"].includes(item.status) && (
                <button
                  onClick={() => onAction(item, "retry")}
                  className="rounded-md bg-[#21104a] px-2.5 py-1.5 text-xs font-bold text-white"
                >
                  <RefreshCw className="mr-1 inline h-3 w-3" />
                  Chạy lại
                </button>
              )}
              {["queued", "processing"].includes(item.status) && (
                <button
                  onClick={() => onAction(item, "cancel")}
                  className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700"
                >
                  Hủy
                </button>
              )}
            </div>
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

function SupportTable({
  tickets,
  onUpdate,
}: {
  tickets: Ticket[];
  onUpdate: (ticket: Ticket, status: string) => void;
}) {
  return (
    <TableShell
      headers={[
        "Yêu cầu",
        "Khách hàng",
        "Phân loại",
        "Ưu tiên",
        "Trạng thái",
        "Tin nhắn",
        "Cập nhật",
      ]}
      empty={!tickets.length}
    >
      {tickets.map((item) => (
        <tr key={item.id}>
          <td className="max-w-72 px-4 py-3">
            <p className="truncate font-bold">{item.subject}</p>
            <p className="text-xs text-[#756894]">
              #{item.id} · {formatDate(item.created_at)}
            </p>
          </td>
          <td className="px-4 py-3">
            <p>{item.name}</p>
            <p className="text-xs text-[#756894]">{item.email}</p>
          </td>
          <td className="px-4 py-3">{item.category}</td>
          <td className="px-4 py-3">{item.priority}</td>
          <td className="px-4 py-3">
            <Badge status={item.status}>{item.status}</Badge>
          </td>
          <td className="px-4 py-3">{item.message_count}</td>
          <td className="px-4 py-3">
            <select
              value={item.status}
              onChange={(event) => void onUpdate(item, event.target.value)}
              className="rounded-md border border-[#ddd5e8] bg-white px-2 py-1.5 text-xs"
            >
              <option value="open">Mở</option>
              <option value="pending">Chờ</option>
              <option value="resolved">Đã xử lý</option>
              <option value="closed">Đóng</option>
            </select>
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

function AuditTable({ logs }: { logs: AuditLog[] }) {
  return (
    <TableShell
      headers={[
        "Thời gian",
        "Người thực hiện",
        "Hành động",
        "Đối tượng",
        "Lý do",
        "Request ID",
      ]}
      empty={!logs.length}
    >
      {logs.map((item) => (
        <tr key={item.id}>
          <td className="px-4 py-3">{formatDate(item.created_at)}</td>
          <td className="px-4 py-3">
            <p>{item.actor_name || "Hệ thống"}</p>
            <p className="text-xs text-[#756894]">{item.actor_email}</p>
          </td>
          <td className="px-4 py-3 font-mono text-xs">{item.action}</td>
          <td className="px-4 py-3">
            {item.target_type} #{item.target_id}
          </td>
          <td className="max-w-72 px-4 py-3">{item.reason}</td>
          <td className="px-4 py-3 font-mono text-xs">
            {item.request_id || "-"}
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

function EditUserDialog({
  user,
  isSuperAdmin,
  onClose,
  onSave,
}: {
  user: AdminUser | null;
  isSuperAdmin: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    plan: "free",
    quotaHours: "0",
    alertMinutes: "5",
    accountStatus: "active",
    role: "user",
    adminNote: "",
    reason: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (user)
      setForm({
        plan: user.plan,
        quotaHours: String((Number(user.quota_seconds) || 0) / 3600),
        alertMinutes: String((Number(user.quota_alert_seconds) || 300) / 60),
        accountStatus: user.account_status,
        role: user.role,
        adminNote: user.admin_note || "",
        reason: "",
      });
  }, [user]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({
        plan: form.plan,
        quotaSeconds: Math.round(Number(form.quotaHours) * 3600),
        quotaAlertSeconds: Math.round(Number(form.alertMinutes) * 60),
        accountStatus: form.accountStatus,
        ...(isSuperAdmin ? { role: form.role } : {}),
        adminNote: form.adminNote,
        reason: form.reason,
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Không lưu được người dùng",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      open={Boolean(user)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-xl border-[#e4ddeb] bg-white text-[#21104a]">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa người dùng</DialogTitle>
        </DialogHeader>
        {user && (
          <form className="grid gap-4" onSubmit={submit}>
            <div className="rounded-md bg-[#faf8f2] p-3 text-sm">
              <p className="font-bold">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-xs text-[#756894]">{user.email}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Gói cước">
                <select
                  value={form.plan}
                  onChange={(e) => setForm({ ...form, plan: e.target.value })}
                  className="admin-input"
                >
                  <option value="free">Free</option>
                  <option value="standard">Tiêu chuẩn</option>
                  <option value="special">Đặc biệt</option>
                  <option value="business">Chuyên nghiệp</option>
                </select>
              </Field>
              <Field label="Quota (giờ)">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.quotaHours}
                  onChange={(e) =>
                    setForm({ ...form, quotaHours: e.target.value })
                  }
                  className="admin-input"
                />
              </Field>
              <Field label="Cảnh báo trước (phút)">
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={form.alertMinutes}
                  onChange={(e) =>
                    setForm({ ...form, alertMinutes: e.target.value })
                  }
                  className="admin-input"
                />
              </Field>
              <Field label="Trạng thái">
                <select
                  value={form.accountStatus}
                  onChange={(e) =>
                    setForm({ ...form, accountStatus: e.target.value })
                  }
                  className="admin-input"
                >
                  <option value="active">Hoạt động</option>
                  <option value="blocked">Khóa</option>
                </select>
              </Field>
              {isSuperAdmin && (
                <Field label="Vai trò">
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="admin-input"
                  >
                    <option value="user">Người dùng</option>
                    <option value="support">Hỗ trợ</option>
                    <option value="finance">Tài chính</option>
                    <option value="admin">Quản trị</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </Field>
              )}
            </div>
            <Field label="Ghi chú nội bộ">
              <textarea
                value={form.adminNote}
                onChange={(e) =>
                  setForm({ ...form, adminNote: e.target.value })
                }
                className="admin-input min-h-20 resize-y"
              />
            </Field>
            <Field label="Lý do thay đổi *">
              <input
                required
                minLength={3}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="admin-input"
                placeholder="Ví dụ: điều chỉnh theo yêu cầu CSKH #123"
              />
            </Field>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-[#ddd5e8] px-4 py-2 text-sm font-bold"
              >
                Hủy
              </button>
              <button
                disabled={saving}
                className="rounded-md bg-[#ffcb05] px-4 py-2 text-sm font-bold text-[#21104a] disabled:opacity-60"
              >
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-bold text-[#65587c]">
      <span>{label}</span>
      {children}
    </label>
  );
}
