import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { AuthenticatedHeader } from "@/components/auth-app-header";
import { useAuth } from "@/context/AuthContext";
import { formatQuotaTime, type QuotaStatus } from "@/lib/quota";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:3001";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, token, isLoading, updateUser } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "" });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      void navigate({
        to: "/login",
        search: { error: undefined, from: "/profile" },
      });
    }
  }, [isLoading, navigate, user]);

  useEffect(() => {
    if (user) {
      setProfileForm({ firstName: user.firstName, lastName: user.lastName });
    }
  }, [user]);

  useEffect(() => {
    if (!token) return;
    void fetch(`${API_URL}/api/quota/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) =>
        response.ok ? (response.json() as Promise<QuotaStatus>) : null,
      )
      .then(setQuota)
      .catch(() => setQuota(null));
  }, [token]);

  function resizeImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);

      image.onload = () => {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          URL.revokeObjectURL(url);
          reject(new Error("Không thể xử lý ảnh"));
          return;
        }

        canvas.width = 256;
        canvas.height = 256;
        const size = Math.min(image.width, image.height);
        context.drawImage(
          image,
          (image.width - size) / 2,
          (image.height - size) / 2,
          size,
          size,
          0,
          0,
          256,
          256,
        );
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };

      image.onerror = reject;
      image.src = url;
    });
  }

  async function handleAvatarChange(file?: File) {
    if (!file || !token) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setMessage({
        type: "error",
        text: "Vui lòng chọn ảnh JPG, PNG hoặc WEBP không quá 5MB.",
      });
      return;
    }

    setUploadingAvatar(true);
    setMessage(null);
    try {
      const avatar = await resizeImage(file);
      const response = await fetch(`${API_URL}/api/auth/avatar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatar }),
      });
      const data = (await response.json()) as {
        avatar?: string | null;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error);

      updateUser({ avatar: data.avatar ?? avatar });
      setMessage({ type: "success", text: "Đã cập nhật ảnh đại diện." });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error && error.message
            ? error.message
            : "Không thể cập nhật ảnh.",
      });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function saveProfile() {
    if (!token) return;
    const firstName = profileForm.firstName.trim();
    const lastName = profileForm.lastName.trim();
    if (!firstName || !lastName) {
      setMessage({ type: "error", text: "Vui lòng nhập đầy đủ họ và tên." });
      return;
    }

    setSavingProfile(true);
    setMessage(null);
    try {
      const response = await fetch(`${API_URL}/api/auth/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ firstName, lastName }),
      });
      const data = (await response.json()) as {
        firstName?: string;
        lastName?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error);

      updateUser({ firstName: data.firstName, lastName: data.lastName });
      setMessage({ type: "success", text: "Thông tin cá nhân đã được lưu." });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error && error.message
            ? error.message
            : "Không thể lưu thông tin.",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    if (!token) return;
    if (passwordForm.newPassword.length < 6) {
      setMessage({
        type: "error",
        text: "Mật khẩu mới phải có ít nhất 6 ký tự.",
      });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: "error", text: "Mật khẩu xác nhận không khớp." });
      return;
    }

    setSavingPassword(true);
    setMessage(null);
    try {
      const response = await fetch(`${API_URL}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(passwordForm),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error);

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setMessage({
        type: "success",
        text: data.message ?? "Đã đổi mật khẩu.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error && error.message
            ? error.message
            : "Không thể đổi mật khẩu.",
      });
    } finally {
      setSavingPassword(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return null;

  const initials =
    `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AuthenticatedHeader />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative h-24 w-24 shrink-0">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt="Ảnh đại diện"
                  className="h-24 w-24 rounded-full object-cover ring-2 ring-primary/30"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                  {initials}
                </div>
              )}
              <button
                type="button"
                title="Đổi ảnh đại diện"
                disabled={uploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground disabled:opacity-60"
              >
                {uploadingAvatar ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) =>
                  void handleAvatarChange(event.target.files?.[0])
                }
              />
            </div>

            <div className="min-w-0">
              <h1 className="text-3xl font-black">
                {user.firstName} {user.lastName}
              </h1>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {user.email}
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                Gói {quota?.label ?? user.plan ?? "free"}
              </span>
            </div>
          </div>

          <Link
            to="/pricing"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-glow"
          >
            Xem gói dịch vụ
          </Link>
        </div>

        {message && (
          <div
            className={`mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
              message.type === "success"
                ? "border-primary/25 bg-primary/10 text-primary"
                : "border-destructive/25 bg-destructive/10 text-destructive"
            }`}
          >
            {message.type === "success" && <Check className="h-4 w-4" />}
            {message.text}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <section className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="mb-5 flex items-center gap-2">
                <UserRound className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-black">Thông tin cá nhân</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold">
                  Tên
                  <input
                    value={profileForm.firstName}
                    onChange={(event) =>
                      setProfileForm((value) => ({
                        ...value,
                        firstName: event.target.value,
                      }))
                    }
                    className="h-11 rounded-xl border border-border bg-background px-3 outline-none focus:border-primary"
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Họ
                  <input
                    value={profileForm.lastName}
                    onChange={(event) =>
                      setProfileForm((value) => ({
                        ...value,
                        lastName: event.target.value,
                      }))
                    }
                    className="h-11 rounded-xl border border-border bg-background px-3 outline-none focus:border-primary"
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold sm:col-span-2">
                  Email
                  <input
                    value={user.email}
                    disabled
                    className="h-11 rounded-xl border border-border bg-muted/40 px-3 text-muted-foreground"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => void saveProfile()}
                disabled={savingProfile}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-black text-primary-foreground disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {savingProfile ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="mb-5 flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-black">Đổi mật khẩu</h2>
              </div>
              <div className="grid gap-4">
                {[
                  ["currentPassword", "Mật khẩu hiện tại"],
                  ["newPassword", "Mật khẩu mới"],
                  ["confirmPassword", "Xác nhận mật khẩu mới"],
                ].map(([field, label]) => (
                  <label key={field} className="grid gap-2 text-sm font-bold">
                    {label}
                    <div className="relative">
                      <input
                        type={showPasswords ? "text" : "password"}
                        value={passwordForm[field as keyof typeof passwordForm]}
                        onChange={(event) =>
                          setPasswordForm((value) => ({
                            ...value,
                            [field]: event.target.value,
                          }))
                        }
                        className="h-11 w-full rounded-xl border border-border bg-background px-3 pr-11 outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        title={showPasswords ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                        onClick={() => setShowPasswords((value) => !value)}
                        className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-muted-foreground"
                      >
                        {showPasswords ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void changePassword()}
                disabled={savingPassword}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-black text-primary-foreground disabled:opacity-60"
              >
                <KeyRound className="h-4 w-4" />
                {savingPassword ? "Đang xử lý..." : "Đổi mật khẩu"}
              </button>
            </div>
          </section>

          <aside className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h2 className="text-lg font-black">Hạn mức sử dụng</h2>
            {quota ? (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Còn lại</p>
                  <p className="mt-1 text-3xl font-black text-primary">
                    {formatQuotaTime(quota.remainingSeconds)}
                  </p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-background">
                  <div
                    className={`h-full rounded-full ${
                      quota.isLimitReached ? "bg-destructive" : "bg-primary"
                    }`}
                    style={{ width: `${quota.percentUsed}%` }}
                  />
                </div>
                <p className="text-sm font-semibold text-muted-foreground">
                  Đã dùng {formatQuotaTime(quota.usedSeconds)} /{" "}
                  {formatQuotaTime(quota.quotaSeconds)}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Đang tải thông tin hạn mức...
              </p>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
