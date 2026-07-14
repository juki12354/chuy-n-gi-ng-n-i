import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import type { ComponentType } from "react";
import {
  AudioLines,
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  Clock,
  Download,
  FileAudio,
  Folder,
  FolderPlus,
  Gift,
  Heart,
  History,
  Home,
  Languages,
  LogOut,
  MessageCircle,
  Mic,
  Pencil,
  PlugZap,
  Radio,
  Settings,
  SlidersHorizontal,
  Upload,
  UploadCloud,
  User,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import vbeeLogo from "@/assets/vbee-logo.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuotaStatusPanel } from "@/components/quota-status-panel";
import { PhilosophyQuoteCard } from "@/components/philosophy-quote-card";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:3001";

const SPARKLES = [
  { top: "6%", left: "18%", delay: 0, size: "h-1.5 w-1.5" },
  { top: "11%", left: "78%", delay: 0.7, size: "h-1 w-1" },
  { top: "30%", left: "94%", delay: 1.3, size: "h-1 w-1" },
  { top: "45%", left: "1%", delay: 0.4, size: "h-2 w-2" },
  { top: "60%", left: "96%", delay: 1.8, size: "h-1 w-1" },
  { top: "72%", left: "5%", delay: 0.9, size: "h-1.5 w-1.5" },
  { top: "84%", left: "88%", delay: 1.5, size: "h-1 w-1" },
  { top: "90%", left: "35%", delay: 0.2, size: "h-2 w-2" },
  { top: "3%", left: "55%", delay: 1.1, size: "h-1 w-1" },
  { top: "50%", left: "2%", delay: 0.6, size: "h-1 w-1" },
];

interface HistoryItem {
  id: number;
  filename: string;
  duration: number | null;
  text: string;
  created_at: string;
}

type ActionDialogState = {
  title: string;
  description: string;
  ctaLabel?: string;
  to?: string;
};

function formatDuration(seconds?: number | null) {
  if (!seconds) return "Chưa xử lý";
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: search.token as string | undefined,
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { token: urlToken } = Route.useSearch();
  const { user, isLoading, token, setToken, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (!user || !token) return;
    void fetch(`${API_URL}/api/transcribe/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? (r.json() as Promise<HistoryItem[]>) : []))
      .then((data) => setHistory(data.slice(0, 3)));
  }, [user, token]);

  // ── Edit profile state ──────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "" });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("Dự án mới");
  const [activeFolder, setActiveFolder] = useState("Dự án mới");
  const [actionDialog, setActionDialog] = useState<ActionDialogState | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Xử lý token từ URL (sau OAuth redirect)
  useEffect(() => {
    if (urlToken) {
      setToken(urlToken);
      void navigate({
        to: "/dashboard",
        replace: true,
        search: { token: undefined },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoading && !user && !urlToken) {
      void navigate({
        to: "/login",
        search: { error: undefined, from: "/dashboard" },
      });
    }
  }, [user, isLoading, urlToken, navigate]);

  useEffect(() => {
    if (user)
      setEditForm({ firstName: user.firstName, lastName: user.lastName });
  }, [user]);

  // ── Handlers ────────────────────────────────────────────────────────
  function handleLogout() {
    logout();
    window.location.href = "/login";
  }

  function openEdit() {
    if (user)
      setEditForm({ firstName: user.firstName, lastName: user.lastName });
    setAvatarPreview(null);
    setProfileError("");
    setProfileSuccess(false);
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setAvatarPreview(null);
    setProfileError("");
    setProfileSuccess(false);
  }

  function resizeImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const SIZE = 256;
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d")!;
        const min = Math.min(img.width, img.height);
        ctx.drawImage(
          img,
          (img.width - min) / 2,
          (img.height - min) / 2,
          min,
          min,
          0,
          0,
          SIZE,
          SIZE,
        );
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function handleAvatarFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileError("Vui lòng chọn file ảnh hợp lệ");
      return;
    }
    setProfileError("");
    setIsSavingAvatar(true);
    try {
      const base64 = await resizeImage(file);
      setAvatarPreview(base64);
      const res = await fetch(`${API_URL}/api/auth/avatar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatar: base64 }),
      });
      const data = (await res.json()) as { avatar?: string; error?: string };
      if (!res.ok) {
        setProfileError(data.error ?? "Lỗi khi lưu ảnh");
        return;
      }
      updateUser({ avatar: data.avatar ?? null });
    } catch {
      setProfileError("Có lỗi xảy ra khi tải ảnh lên");
    } finally {
      setIsSavingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSaveProfile() {
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      setProfileError("Vui lòng điền đầy đủ họ và tên");
      return;
    }
    setProfileError("");
    setProfileSuccess(false);
    setIsSavingProfile(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: editForm.firstName.trim(),
          lastName: editForm.lastName.trim(),
        }),
      });
      const data = (await res.json()) as {
        firstName?: string;
        lastName?: string;
        error?: string;
      };
      if (!res.ok) {
        setProfileError(data.error ?? "Lưu thất bại");
        return;
      }
      updateUser({ firstName: data.firstName, lastName: data.lastName });
      setProfileSuccess(true);
      setTimeout(() => {
        setProfileSuccess(false);
        closeEdit();
      }, 1200);
    } catch {
      setProfileError("Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  function handleCreateFolder() {
    const name = folderName.trim();
    if (!name) return;
    setActiveFolder(name);
    setFolderOpen(false);
    setFolderName("Dự án mới");
  }

  function openFeature(label: string) {
    const normalized = label.toLowerCase();
    if (
      normalized.includes("transcription") ||
      normalized.includes("chuyển giọng nói")
    ) {
      void navigate({ to: "/transcription-settings" });
      return;
    }
    if (normalized.includes("dictionary") || normalized.includes("từ điển")) {
      void navigate({ to: "/custom-dictionary" });
      return;
    }
    if (normalized.includes("upload") || normalized.includes("tải lên")) {
      void navigate({ to: "/upload" });
      return;
    }
    if (
      normalized.includes("zoom") ||
      normalized.includes("teams") ||
      normalized.includes("zapier")
    ) {
      setActionDialog({
        title: label,
        description:
          "Phần tích hợp này sẽ dùng API key và webhook. Mở trang API để tạo key, test endpoint và chuẩn bị tích hợp giống Sonix.",
        ctaLabel: "Mở trang API",
        to: "/api",
      });
      return;
    }
    if (normalized.includes("analysis") || normalized.includes("phân tích")) {
      setActionDialog({
        title: label,
        description:
          "Phân tích AI sẽ dùng bản chép lời đã tạo để tóm tắt, trích ý chính và tìm chủ đề. Trước mắt bạn có thể mở lịch sử để chọn bản chép lời cần phân tích.",
        ctaLabel: "Mở lịch sử",
        to: "/history",
      });
      return;
    }
    if (
      normalized.includes("help") ||
      normalized.includes("video") ||
      normalized.includes("hỗ trợ")
    ) {
      setActionDialog({
        title: label,
        description:
          "Bạn có thể dùng trang ghi âm để mở bảng trợ giúp, hoặc quay lại tải file hoặc ghi âm để bắt đầu.",
        ctaLabel: "Mở ghi âm",
        to: "/record",
      });
      return;
    }
    setActionDialog({
      title: label,
      description:
        "Thiết lập này đã có điểm bấm và sẽ được nối sâu hơn khi có màn cấu hình riêng.",
    });
  }

  // ── Loading ──────────────────────────────────────────────────────────
  if (isLoading || (urlToken && !user)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-sm">
            Đang xử lý đăng nhập...
          </p>
        </div>
      </div>
    );
  }
  if (!user) return null;

  const initials =
    `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background font-sans text-foreground antialiased">
      {/* ── Nền ──────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <div className="absolute top-[8%]  left-[5%]   h-80 w-80 rounded-full bg-primary/15 blur-3xl animate-float pointer-events-none" />
      <div
        className="absolute bottom-[5%] right-[4%] h-64 w-64 rounded-full bg-primary/10 blur-3xl animate-float pointer-events-none"
        style={{ animationDelay: "1.6s" }}
      />
      <div
        className="absolute top-[50%] left-[65%]  h-48 w-48 rounded-full bg-primary/20 blur-2xl animate-float pointer-events-none"
        style={{ animationDelay: "0.8s" }}
      />
      {SPARKLES.map((s, i) => (
        <span
          key={i}
          className={`absolute ${s.size} rounded-full bg-primary animate-twinkle pointer-events-none`}
          style={{ top: s.top, left: s.left, animationDelay: `${s.delay}s` }}
        />
      ))}

      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="relative z-30 border-b border-border bg-background/70 backdrop-blur-md">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center">
            <img
              src={vbeeLogo}
              alt="Vbee"
              className="h-14 w-auto object-contain"
            />
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <Link to="/upload" className="hover:text-foreground transition">
              Tải file lên
            </Link>
            <Link to="/record" className="hover:text-foreground transition">
              Ghi âm
            </Link>
            <Link
              to="/realtime"
              className="hover:text-foreground transition flex items-center gap-1.5"
            >
              <Radio className="h-3.5 w-3.5" />
              Realtime
            </Link>
            <Link
              to="/history"
              className="hover:text-foreground transition flex items-center gap-1.5"
            >
              <History className="h-3.5 w-3.5" />
              Lịch sử
            </Link>
            <Link
              to="/api"
              className="hover:text-foreground transition flex items-center gap-1.5"
            >
              <PlugZap className="h-3.5 w-3.5" />
              API
            </Link>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 hover:bg-card transition focus:outline-none focus:ring-2 focus:ring-primary/50">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt="avatar"
                    className="h-8 w-8 rounded-full object-cover ring-1 ring-primary/40"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground shadow-glow select-none">
                    {initials}
                  </span>
                )}
                <span className="hidden sm:block text-sm font-medium text-foreground max-w-[120px] truncate">
                  {user.firstName} {user.lastName}
                </span>
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 bg-card border-border"
            >
              <DropdownMenuLabel className="pb-1">
                <p className="text-sm font-semibold text-foreground">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-muted-foreground font-normal truncate">
                  {user.email}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 cursor-pointer hover:bg-primary/10 focus:bg-primary/10"
                onSelect={openEdit}
              >
                <Pencil className="h-4 w-4 text-primary" />
                Chỉnh sửa thông tin
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 cursor-pointer text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
                onSelect={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </header>

      {/* ── Main ─────────────────────────────────────────────────────── */}
      <main className="relative z-10 mx-auto grid max-w-7xl gap-6 px-4 py-8 md:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0">
          <div className="mb-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-black text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  Không gian làm việc sẵn sàng
                </div>
                <div className="flex items-center gap-3">
                  <Heart className="h-10 w-10 text-primary" />
                  <h1 className="text-2xl font-light tracking-tight text-foreground md:text-3xl">
                    Chào mừng, {user.firstName}
                  </h1>
                </div>
              </div>
              <Link
                to="/history"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-2 text-sm font-bold text-muted-foreground transition hover:border-primary/50 hover:text-primary"
              >
                Xem lịch sử
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <Link
              to="/"
              className="mb-3 flex items-center justify-center rounded-md border border-border bg-card/75 px-4 py-2 text-sm font-bold text-foreground/85 shadow-soft transition hover:border-primary/45 hover:bg-primary/5 hover:text-primary"
            >
              <Home className="mr-2 h-4 w-4 text-primary" />
              Trang chủ
            </Link>

            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Link
                to="/upload"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-glow transition hover:opacity-90"
              >
                <Upload className="h-4 w-4" />
                TẢI FILE
              </Link>
              <button
                onClick={() => setFolderOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card/70 px-5 py-3 text-sm font-black text-foreground transition hover:border-primary/50 hover:text-primary"
              >
                <FolderPlus className="h-4 w-4" />
                THƯ MỤC MỚI
              </button>
              <Link
                to="/record"
                className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-border bg-card/70 text-muted-foreground transition hover:border-primary/50 hover:text-primary"
                title="Ghi âm nhanh"
              >
                <Mic className="h-4 w-4" />
              </Link>
              <Link
                to="/realtime"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-5 py-3 text-sm font-black text-primary transition hover:bg-primary/20"
              >
                <Radio className="h-4 w-4" />
                REALTIME
              </Link>
            </div>

            <CustomerJourneyPanel />
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card/75 shadow-soft">
            <div className="border-b border-border bg-background/35 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
                    DỰ ÁN
                  </p>
                  <div className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <Folder className="h-4 w-4 text-primary" />
                    {activeFolder}
                  </div>
                </div>
                <div className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {history.length} tệp
                </div>
              </div>
            </div>

            {history.length === 0 ? (
              <div className="m-5 rounded-2xl border border-dashed border-border bg-background/35 p-8 text-center">
                <UploadCloud className="mx-auto h-12 w-12 text-primary" />
                <h2 className="mt-4 text-xl font-black">
                  Chưa có file transcript
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Bắt đầu giống Sonix: tải file, ghi âm trực tiếp, rồi mọi bản
                  transcript sẽ xuất hiện trong workspace này.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <Link
                    to="/upload"
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-glow"
                  >
                    <Upload className="h-4 w-4" />
                    Tải file đầu tiên
                  </Link>
                  <Link
                    to="/record"
                    className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-black transition hover:border-primary/50 hover:text-primary"
                  >
                    <Mic className="h-4 w-4" />
                    Ghi âm ngay
                  </Link>
                </div>
              </div>
            ) : (
              history.map((item) => (
                <WorkspaceFileRow key={item.id} item={item} />
              ))
            )}

            <div className="border-t border-border bg-background/35 px-5 py-4 text-center text-sm font-black text-primary">
              {history.length} tệp,{" "}
              {formatDuration(
                history.reduce((sum, item) => sum + (item.duration ?? 0), 0),
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              [Languages, "54+ ngôn ngữ", "Chuyển giọng nói và dịch nhiều ngôn ngữ"],
              [
                AudioLines,
                "Mốc thời gian từng từ",
                "Đánh dấu theo từng từ khi phát âm thanh",
              ],
              [
                Radio,
                "Chuyển giọng nói trực tiếp",
                "Nói trực tiếp và lưu bản chép lời vào lịch sử",
              ],
              [
                Download,
                "Xuất nhanh",
                "DOCX, âm thanh và bản chép lời đã chỉnh sửa",
              ],
            ].map(([Icon, title, desc]) => (
              <div
                key={String(title)}
                className="rounded-2xl border border-border bg-card/70 p-5 shadow-soft"
              >
                <Icon className="mb-3 h-5 w-5 text-primary" />
                <h3 className="font-black">{String(title)}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {String(desc)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-5 lg:pt-28">
          <div className="rounded-2xl border border-border bg-card/85 p-6 shadow-soft">
            <div className="mb-5 flex items-center gap-3">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt="avatar"
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-primary/40"
                />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary font-black text-primary-foreground shadow-glow">
                  {initials}
                </span>
              )}
              <h2 className="text-xl font-bold leading-tight">
                Xin chào,
                <br />
                {user.firstName}
              </h2>
            </div>

            <div className="mb-5">
              <QuotaStatusPanel />
            </div>

            <DashboardSideSection
              title="TÙY CHỈNH"
              items={[
                [Settings, "Cài đặt chuyển giọng nói"],
                [BookOpen, "Từ điển riêng"],
                [UploadCloud, "Cài đặt tải lên"],
              ]}
              onAction={openFeature}
            />
            <DashboardSideSection
              title="PHÂN TÍCH AI"
              items={[[SlidersHorizontal, "Cài đặt phân tích AI"]]}
              onAction={openFeature}
            />
            <DashboardSideSection
              title="TÍCH HỢP"
              items={[
                [FileAudio, "Tích hợp Zoom"],
                [Mic, "Tích hợp Microsoft Teams"],
                [Zap, "Tự động hóa Zapier"],
              ]}
              onAction={openFeature}
            />
            <DashboardSideSection
              title="HỖ TRỢ"
              items={[
                [BookOpen, "Video hướng dẫn"],
                [MessageCircle, "Trung tâm hỗ trợ"],
              ]}
              onAction={openFeature}
            />

            <button
              onClick={() =>
                setActionDialog({
                  title: "Giới thiệu bạn bè",
                  description:
                    "Chương trình giới thiệu bạn bè sẽ cấp phút miễn phí sau khi người được mời đăng ký và dùng thử.",
                  ctaLabel: "Mở trang chủ",
                  to: "/",
                })
              }
              className="mt-5 w-full rounded-xl border border-border bg-background/35 p-4 text-left transition hover:border-primary/50 hover:bg-primary/10"
            >
              <div className="flex items-center gap-3">
                <Gift className="h-8 w-8 text-primary" />
                <p className="text-sm font-black leading-5 text-primary">
                  GIỚI THIỆU BẠN BÈ
                  <br />
                  NHẬN 100 PHÚT MIỄN PHÍ
                </p>
              </div>
            </button>
          </div>

          <PhilosophyQuoteCard />
        </aside>
      </main>

      {/* ── Edit Profile Dialog ──────────────────────────────────────── */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleAvatarFileChange(e)}
      />

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) closeEdit();
        }}
      >
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-xl">
              Chỉnh sửa thông tin
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-5 py-2">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                {(avatarPreview ?? user.avatar) ? (
                  <img
                    src={avatarPreview ?? user.avatar!}
                    alt="avatar"
                    className="h-20 w-20 rounded-full object-cover shadow-glow ring-2 ring-primary/40"
                  />
                ) : (
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-primary text-2xl font-bold text-primary-foreground shadow-glow select-none">
                    {initials}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSavingAvatar}
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-card border border-border hover:bg-primary/10 transition disabled:opacity-50"
                  title="Thay ảnh đại diện"
                >
                  {isSavingAvatar ? (
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5 text-primary" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {isSavingAvatar
                  ? "Đang lưu ảnh..."
                  : "Nhấn biểu tượng camera để thay ảnh"}
              </p>
            </div>

            {profileError && (
              <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                <X className="h-4 w-4 shrink-0" />
                {profileError}
              </div>
            )}
            {profileSuccess && (
              <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 py-2 text-sm text-primary">
                <Check className="h-4 w-4 shrink-0" />
                Đã lưu thành công!
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Tên
                </label>
                <input
                  value={editForm.firstName}
                  onChange={(e) => {
                    setEditForm((p) => ({ ...p, firstName: e.target.value }));
                    setProfileError("");
                  }}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  placeholder="Tên"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Họ
                </label>
                <input
                  value={editForm.lastName}
                  onChange={(e) => {
                    setEditForm((p) => ({ ...p, lastName: e.target.value }));
                    setProfileError("");
                  }}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  placeholder="Họ"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Email
              </label>
              <input
                value={user.email}
                disabled
                className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground/60">
                Email liên kết với tài khoản, không thể thay đổi
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={closeEdit}
                disabled={isSavingProfile}
                className="flex-1 rounded-full border border-border py-2.5 text-sm font-medium text-foreground hover:bg-card transition disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={() => void handleSaveProfile()}
                disabled={isSavingProfile || isSavingAvatar}
                className="flex-1 flex items-center justify-center gap-2 rounded-full bg-gradient-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 transition disabled:opacity-60"
              >
                {isSavingProfile ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  "Lưu thay đổi"
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent className="border-border bg-card text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tạo folder mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">
              Folder sẽ được hiển thị trong workspace hiện tại để bạn tổ chức
              transcript giống Sonix.
            </p>
            <input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              placeholder="Tên folder"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setFolderOpen(false)}
                className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-bold transition hover:bg-background"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateFolder}
                className="flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground shadow-glow transition hover:opacity-90"
              >
                Tạo folder
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(actionDialog)}
        onOpenChange={(open) => {
          if (!open) setActionDialog(null);
        }}
      >
        <DialogContent className="border-border bg-card text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{actionDialog?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">
              {actionDialog?.description}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setActionDialog(null)}
                className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-bold transition hover:bg-background"
              >
                Đóng
              </button>
              {actionDialog?.ctaLabel && actionDialog.to && (
                <button
                  onClick={() => {
                    const to = actionDialog.to;
                    setActionDialog(null);
                    if (to) void navigate({ to });
                  }}
                  className="flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground shadow-glow transition hover:opacity-90"
                >
                  {actionDialog.ctaLabel}
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomerJourneyPanel() {
  const steps = [
    {
      icon: UploadCloud,
      step: "01",
      title: "Tạo bản chép lời",
      desc: "Tải file âm thanh, video hoặc ghi âm trực tiếp để bắt đầu.",
      cta: "Tải file",
      to: "/upload",
    },
    {
      icon: Radio,
      step: "02",
      title: "Nói trực tiếp",
      desc: "Dùng khi cần ghi nhanh cuộc họp, ý tưởng hoặc phỏng vấn đang diễn ra.",
      cta: "Mở ghi âm trực tiếp",
      to: "/realtime",
    },
    {
      icon: Languages,
      step: "03",
      title: "Sửa, dịch, xuất tệp",
      desc: "Mở bản chép lời đã tạo để sao chép, tải DOCX/TXT và xem bản dịch.",
      cta: "Xem lịch sử",
      to: "/history",
    },
    {
      icon: Clock,
      step: "04",
      title: "Theo dõi hạn mức",
      desc: "Khi gần hết thời gian sử dụng, chọn gói phù hợp để tiếp tục xử lý.",
      cta: "Xem gói cước",
      to: "/pricing",
    },
  ] as const;

  return (
    <div className="mt-5 rounded-2xl border border-border bg-card/75 p-4 shadow-soft">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
            Luồng khách hàng
          </p>
          <h2 className="mt-1 text-xl font-black text-foreground">
            Bắt đầu, xử lý, xuất file và quay lại lịch sử trong một đường đi
          </h2>
        </div>
        <span className="w-fit rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-black text-primary">
          Luồng Vbee
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.step}
              to={item.to}
              className="group rounded-2xl border border-border bg-background/35 p-4 transition hover:-translate-y-0.5 hover:border-primary/55 hover:bg-primary/10"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-primary">
                  {item.step}
                </span>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-glow">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <h3 className="mt-4 text-base font-black text-foreground">
                {item.title}
              </h3>
              <p className="mt-2 min-h-[3rem] text-sm leading-6 text-muted-foreground">
                {item.desc}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-primary">
                {item.cta}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function WorkspaceFileRow({ item }: { item: HistoryItem }) {
  const Icon = item.filename.startsWith("recording.") ? Mic : AudioLines;

  return (
    <Link
      to="/history"
      className="block border-t border-border px-5 py-5 transition hover:bg-primary/5"
    >
      <div className="grid gap-y-4 text-sm sm:grid-cols-[130px_minmax(0,1fr)]">
        <p className="font-black text-muted-foreground">Tên tệp</p>
        <span className="flex min-w-0 items-center gap-2 font-semibold text-primary">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{item.filename}</span>
        </span>

        <p className="font-black text-muted-foreground">Trạng thái</p>
        <span className="inline-flex w-fit min-w-36 items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-xs font-black text-white">
          <Check className="h-3.5 w-3.5" />
          Đã chuyển thành văn bản
        </span>

        <p className="font-black text-muted-foreground">Thời lượng</p>
        <p className="font-semibold">{formatDuration(item.duration)}</p>

        <p className="font-black text-muted-foreground">Ngày tạo</p>
        <p className="font-semibold">{formatDate(item.created_at)}</p>
      </div>
    </Link>
  );
}

function DashboardSideSection({
  title,
  items,
  onAction,
}: {
  title: string;
  items: Array<[ComponentType<{ className?: string }>, string]>;
  onAction: (label: string) => void;
}) {
  return (
    <div className="mt-5">
      <h3 className="mb-2 text-sm font-black text-primary">{title}</h3>
      <div className="overflow-hidden rounded-xl border border-border">
        {items.map(([Icon, label]) => (
          <button
            key={label}
            onClick={() => onAction(label)}
            className="flex w-full items-center gap-3 border-b border-border bg-background/35 px-4 py-3 text-left text-sm font-semibold text-muted-foreground transition last:border-b-0 hover:bg-primary/10 hover:text-primary"
          >
            <Icon className="h-4 w-4 text-primary" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
