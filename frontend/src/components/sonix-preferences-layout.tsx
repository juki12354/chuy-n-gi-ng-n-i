import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  Clock,
  FileAudio,
  Gift,
  Heart,
  MessageCircle,
  Mic,
  Settings,
  SlidersHorizontal,
  UploadCloud,
  Zap,
} from "lucide-react";
import { QuotaStatusPanel } from "@/components/quota-status-panel";

type ActiveItem = "transcription" | "dictionary" | "upload" | "analysis";
type AppRoute =
  | "/"
  | "/api"
  | "/custom-dictionary"
  | "/history"
  | "/record"
  | "/transcription-settings"
  | "/upload";
type SidebarLink = {
  icon: LucideIcon;
  label: string;
  to: AppRoute;
  active?: ActiveItem;
};

const CUSTOMIZE_LINKS: SidebarLink[] = [
  {
    icon: Settings,
    label: "Transcription settings",
    to: "/transcription-settings",
    active: "transcription",
  },
  {
    icon: BookOpen,
    label: "Custom dictionary",
    to: "/custom-dictionary",
    active: "dictionary",
  },
  {
    icon: UploadCloud,
    label: "Upload settings",
    to: "/upload",
    active: "upload",
  },
];

const ANALYSIS_LINKS: SidebarLink[] = [
  {
    icon: SlidersHorizontal,
    label: "AI analysis settings",
    to: "/history",
    active: "analysis",
  },
];

const INTEGRATION_LINKS: SidebarLink[] = [
  { icon: FileAudio, label: "Zoom integration", to: "/api" },
  { icon: Mic, label: "Microsoft Teams integration", to: "/api" },
  { icon: Zap, label: "Zapier automation", to: "/api" },
];

const HELP_LINKS: SidebarLink[] = [
  { icon: BookOpen, label: "Introduction to Sonix videos", to: "/record" },
  { icon: MessageCircle, label: "Transcriptionist directory", to: "/record" },
  { icon: MessageCircle, label: "Product feature requests", to: "/record" },
  { icon: MessageCircle, label: "Sonix help center", to: "/record" },
];

function SidebarSection({
  title,
  links,
  active,
}: {
  title: string;
  links: SidebarLink[];
  active?: ActiveItem;
}) {
  return (
    <div className="mt-5">
      <h3 className="mb-2 text-sm font-black uppercase tracking-[0.08em] text-primary">
        {title}
      </h3>
      <div className="overflow-hidden rounded-xl border border-border bg-background/35">
        {links.map((item) => {
          const Icon = item.icon;
          const isActive = item.active && item.active === active;
          return (
            <Link
              key={`${title}-${item.label}`}
              to={item.to}
              className={`flex items-center gap-2 border-b border-border px-3 py-2.5 text-sm font-semibold transition last:border-b-0 ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function SonixPreferencesSidebar({
  active,
  firstName,
}: {
  active?: ActiveItem;
  firstName: string;
}) {
  return (
    <aside className="space-y-5 lg:pt-24">
      <div className="rounded-2xl border border-border bg-card/85 p-6 shadow-soft">
        <div className="mb-5 flex items-center gap-3">
          <Heart className="h-7 w-7 text-primary" />
          <h2 className="text-2xl font-bold leading-tight">
            Nice to see you,
            <br />
            {firstName}
          </h2>
        </div>

        <div className="mb-5 rounded-xl bg-primary/10 p-4">
          <div className="flex items-center gap-2 text-sm font-black text-primary">
            <Clock className="h-4 w-4" />
            Pay as you go
            <ArrowRight className="h-4 w-4" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Quota và giới hạn được tính theo gói hiện tại.
          </p>
        </div>

        <div className="mb-5">
          <QuotaStatusPanel compact />
        </div>

        <SidebarSection
          title="CUSTOMIZE"
          links={CUSTOMIZE_LINKS}
          active={active}
        />
        <SidebarSection
          title="AI ANALYSIS"
          links={ANALYSIS_LINKS}
          active={active}
        />
        <SidebarSection title="INTEGRATIONS" links={INTEGRATION_LINKS} />
        <SidebarSection title="NEED HELP?" links={HELP_LINKS} />

        <Link
          to="/"
          className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-background/35 p-4 transition hover:border-primary/50 hover:bg-primary/10"
        >
          <Gift className="h-8 w-8 text-primary" />
          <p className="text-sm font-black leading-5 text-primary">
            REFER A FRIEND AND
            <br />
            GET 100 FREE MINUTES
          </p>
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-card/85 p-6 shadow-soft">
        <p className="text-5xl font-black leading-none text-primary/30">“</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          The only place success comes before work is in the dictionary.
        </p>
        <p className="mt-3 text-sm font-black text-primary">VINCE LOMBARDI</p>
      </div>
    </aside>
  );
}

export function SonixPreferencesFooter() {
  return (
    <footer className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground">
      <p>© 2026 Vbee AIVoice. All rights reserved.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-4">
        {["Sonix.ai", "Pricing", "About", "Privacy", "Terms", "Security"].map(
          (item) => (
            <Link
              key={item}
              to="/"
              className="font-semibold text-primary hover:underline"
            >
              {item}
            </Link>
          ),
        )}
      </div>
      <p className="mt-5">
        Made with <span className="text-primary">♡</span> and careful speech AI
        design.
      </p>
    </footer>
  );
}
