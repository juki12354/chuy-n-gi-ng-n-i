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
    <header className="sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
        <Link to="/" className="flex items-center">
          <img
            src={vbeeLogo}
            alt="Vbee"
            className="h-12 w-auto object-contain md:h-14"
          />
        </Link>

        <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-1.5 transition ${
                  active ? "text-primary" : "hover:text-foreground"
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
              <button className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 transition hover:bg-card focus:outline-none focus:ring-2 focus:ring-primary/50">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt="avatar"
                    className="h-8 w-8 rounded-full object-cover ring-1 ring-primary/40"
                  />
                ) : (
                  <span className="flex h-8 w-8 select-none items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground shadow-glow">
                    {initials}
                  </span>
                )}
                <span className="hidden max-w-[120px] truncate text-sm font-medium text-foreground sm:block">
                  {user.firstName} {user.lastName}
                </span>
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 border-border bg-card"
            >
              <DropdownMenuLabel className="pb-1">
                <p className="text-sm font-semibold text-foreground">
                  {user.firstName} {user.lastName}
                </p>
                <p className="truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                <Link to="/dashboard" search={{ token: undefined }}>
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
              <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card/60 text-primary transition hover:bg-card md:hidden">
                <Menu className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 border-border bg-card md:hidden"
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
                      <Icon className="h-4 w-4 text-primary" />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      <div className="grid grid-cols-5 border-t border-border bg-background/55 md:hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-1 px-2 py-2 text-[11px] font-semibold transition ${
                active ? "text-primary" : "text-muted-foreground"
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
