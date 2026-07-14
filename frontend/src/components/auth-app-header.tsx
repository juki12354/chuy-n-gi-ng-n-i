import { Link, useRouterState } from "@tanstack/react-router";
import {
  History,
  Home,
  LogOut,
  Menu,
  Mic,
  PlugZap,
  Radio,
  Upload,
  User,
} from "lucide-react";
import { VbeeBrandLogo } from "@/components/vbee-brand-logo";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV_ITEMS = [
  { to: "/upload", label: "Tải file lên", icon: Upload },
  { to: "/record", label: "Ghi âm", icon: Mic },
  { to: "/realtime", label: "Realtime", icon: Radio },
  { to: "/history", label: "Lịch sử", icon: History },
  { to: "/api", label: "API", icon: PlugZap },
] as const;

export function AuthenticatedHeader() {
  const { user, logout } = useAuth();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  if (!user) return null;

  const initials =
    `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  function handleLogout() {
    logout();
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#e8decc] bg-white/92 text-[#21104a] shadow-[0_8px_28px_rgba(33,16,74,.05)] backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 md:px-6">
        <Link to="/" className="flex items-center" aria-label="Về trang chủ Vbee">
          <VbeeBrandLogo size="compact" />
        </Link>

        <div className="hidden items-center gap-1 text-sm md:flex">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold transition ${
                  active
                    ? "bg-[#21104a] text-white"
                    : "text-[#65587c] hover:bg-[#fbf8ef] hover:text-[#21104a]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full border border-[#e8decc] bg-white px-2 py-1 transition hover:bg-[#fbf8ef] focus:outline-none focus:ring-2 focus:ring-[#ffcb05]/50">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt="avatar"
                    className="h-7 w-7 rounded-full object-cover ring-1 ring-[#ffcb05]/50"
                  />
                ) : (
                  <span className="flex h-7 w-7 select-none items-center justify-center rounded-full bg-[#ffcb05] text-xs font-bold text-[#21104a]">
                    {initials}
                  </span>
                )}
                <span className="hidden max-w-[120px] truncate text-sm font-bold text-[#21104a] sm:block">
                  {user.firstName} {user.lastName}
                </span>
                <User className="h-3.5 w-3.5 text-[#756894]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 rounded-xl border-[#e8decc] bg-white text-[#21104a]"
            >
              <DropdownMenuLabel className="pb-1">
                <p className="text-sm font-semibold text-[#21104a]">
                  {user.firstName} {user.lastName}
                </p>
                <p className="truncate text-xs font-normal text-[#756894]">
                  {user.email}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                <Link to="/upload">
                  <Home className="h-4 w-4 text-primary" />
                  Trang chủ
                </Link>
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e8decc] bg-white text-[#21104a] transition hover:bg-[#fbf8ef] md:hidden">
                <Menu className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 rounded-xl border-[#e8decc] bg-white text-[#21104a] md:hidden"
            >
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem
                    asChild
                    key={item.to}
                    className="gap-2 cursor-pointer"
                  >
                    <Link to={item.to}>
                      <Icon className="h-4 w-4 text-[#21104a]" />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      <div className="grid grid-cols-5 border-t border-[#e8decc] bg-white md:hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-1 px-2 py-1.5 text-[11px] font-bold transition ${
                active ? "bg-[#fbf8ef] text-[#21104a]" : "text-[#756894]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
