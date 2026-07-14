import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Building2,
  Captions,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Crown,
  FileAudio,
  FileText,
  Gift,
  Headphones,
  HelpCircle,
  Languages,
  Mail,
  Menu,
  Minus,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Star,
  UploadCloud,
  Video,
  X,
  Zap,
} from "lucide-react";
import vbeeLogo from "@/assets/vbee-logo.png";
import { VbeeBrandLogo } from "@/components/vbee-brand-logo";
import { useAuth } from "@/context/AuthContext";
import { createCheckout } from "@/lib/billing";
import { type PlanCode } from "@/lib/quota";
import {
  clearPendingPlanPurchase,
  getPendingPlanPurchase,
  savePendingPlanPurchase,
} from "@/lib/plan-purchase";

type BillingCycle = "monthly" | "yearly";
type CompareValue = string | boolean;

type Plan = {
  code: PlanCode;
  name: string;
  label: string;
  desc: string;
  price: string;
  unit: string;
  minutes: string;
  badge?: string;
  saving?: string;
  highlight?: boolean;
  cta: string;
  features: string[];
};

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Bảng giá Vbee AIVoice — Theo tháng và theo năm" },
      {
        name: "description",
        content:
          "Bảng giá Vbee AIVoice với lựa chọn thanh toán theo tháng và theo năm cho nhu cầu chuyển giọng nói thành văn bản.",
      },
      { property: "og:title", content: "Bảng giá Vbee AIVoice" },
      {
        property: "og:description",
        content:
          "So sánh gói Free, Basic, Pro và Business cho nền tảng chuyển giọng nói thành văn bản.",
      },
    ],
  }),
  component: PricingPage,
});

const monthlyPlans: Plan[] = [
  {
    code: "free",
    name: "Free",
    label: "Dùng thử",
    desc: "Phù hợp để kiểm tra chất lượng nhận diện giọng nói.",
    price: "0đ",
    unit: "/tháng",
    minutes: "30 phút",
    cta: "Bắt đầu miễn phí",
    features: ["30 phút xử lý mỗi tháng", "Tải file audio cơ bản", "Ghi âm trực tiếp", "Copy văn bản nhanh"],
  },
  {
    code: "standard",
    name: "Tiêu chuẩn",
    label: "Cá nhân",
    desc: "Dành cho học tập, ghi chú, phỏng vấn ngắn và nội dung cá nhân.",
    price: "39.000đ",
    unit: "/tháng",
    minutes: "300 phút",
    cta: "Chọn gói Tiêu chuẩn",
    features: ["300 phút xử lý mỗi tháng", "Xuất DOCX/TXT", "Lưu lịch sử 30 ngày", "Ưu tiên tốc độ tiêu chuẩn"],
  },
  {
    code: "special",
    name: "Đặc biệt",
    label: "Phổ biến",
    desc: "Cho creator, sinh viên, nhóm nhỏ cần xử lý nhiều file hơn.",
    price: "89.000đ",
    unit: "/tháng",
    minutes: "1.200 phút",
    badge: "Khuyên dùng",
    highlight: true,
    cta: "Đăng ký Đặc biệt",
    features: ["1.200 phút xử lý mỗi tháng", "Nhận diện nhiều người nói", "Xuất DOCX/PDF/TXT", "Lưu lịch sử không giới hạn"],
  },
  {
    code: "business",
    name: "Business",
    label: "Doanh nghiệp",
    desc: "Cho đội nhóm cần giới hạn riêng, bảo mật và hỗ trợ triển khai.",
    price: "Liên hệ",
    unit: "",
    minutes: "Tùy chỉnh",
    cta: "Liên hệ tư vấn",
    features: ["Số phút theo nhu cầu", "Tài khoản đội nhóm", "API tích hợp", "Hỗ trợ kỹ thuật ưu tiên"],
  },
];

const yearlyPlans: Plan[] = [
  {
    code: "free",
    name: "Free",
    label: "Dùng thử",
    desc: "Giữ nguyên gói miễn phí để trải nghiệm trước khi nâng cấp.",
    price: "0đ",
    unit: "/năm",
    minutes: "360 phút/năm",
    cta: "Bắt đầu miễn phí",
    features: ["360 phút xử lý mỗi năm", "Tải file audio cơ bản", "Ghi âm trực tiếp", "Copy văn bản nhanh"],
  },
  {
    code: "standard",
    name: "Tiêu chuẩn",
    label: "Tiết kiệm",
    desc: "Thanh toán năm cho người dùng cá nhân cần dùng đều đặn.",
    price: "390.000đ",
    unit: "/năm",
    minutes: "3.600 phút/năm",
    saving: "Tiết kiệm 2 tháng",
    cta: "Chọn gói Tiêu chuẩn",
    features: ["3.600 phút xử lý mỗi năm", "Xuất DOCX/TXT", "Lưu lịch sử 12 tháng", "Ưu tiên tốc độ tiêu chuẩn"],
  },
  {
    code: "special",
    name: "Đặc biệt",
    label: "Tốt nhất",
    desc: "Gói năm tối ưu chi phí cho người dùng thường xuyên.",
    price: "890.000đ",
    unit: "/năm",
    minutes: "14.400 phút/năm",
    badge: "Tối ưu nhất",
    saving: "Tiết kiệm 178.000đ",
    highlight: true,
    cta: "Đăng ký Đặc biệt năm",
    features: ["14.400 phút xử lý mỗi năm", "Nhận diện nhiều người nói", "Xuất DOCX/PDF/TXT", "Lưu lịch sử không giới hạn"],
  },
  {
    code: "business",
    name: "Business",
    label: "Doanh nghiệp",
    desc: "Hợp đồng năm, SLA riêng và hỗ trợ tích hợp hệ thống.",
    price: "Liên hệ",
    unit: "",
    minutes: "Tùy chỉnh",
    cta: "Nhận báo giá",
    features: ["Số phút theo hợp đồng", "Quản lý người dùng", "API và webhook", "Hỗ trợ triển khai riêng"],
  },
];

const pricingNavigation = [
  {
    label: "Sản phẩm",
    items: [
      { title: "Phiên âm AI", desc: "Audio/video thành văn bản", href: "/#transcription", icon: FileText },
      { title: "Dịch thuật AI", desc: "Dịch transcript nhanh", href: "/#translation", icon: Languages },
      { title: "Phụ đề & chú thích", desc: "Tạo SRT/VTT cho video", href: "/#subtitles", icon: Captions },
      { title: "Vbee API", desc: "Tích hợp vào hệ thống", href: "/api", icon: PlugZap },
    ],
  },
  {
    label: "Công ty",
    items: [
      { title: "Về chúng tôi", desc: "Tầm nhìn và sứ mệnh Vbee", href: "/about", icon: Building2 },
      { title: "Liên hệ", desc: "Tư vấn triển khai", href: "/contact", icon: Mail },
      { title: "Yêu cầu hỗ trợ", desc: "Hỗ trợ kỹ thuật", href: "/support", icon: Headphones },
    ],
  },
  {
    label: "Tài nguyên",
    items: [
      { title: "Blog", desc: "Kiến thức AI speech", href: "/#resources", icon: BookOpen },
      { title: "Videos", desc: "Hướng dẫn sử dụng", href: "/#resources", icon: Video },
      { title: "Tài liệu bán hàng", desc: "Thông tin gói cước", href: "#plans", icon: FileAudio },
      { title: "Trung tâm trợ giúp", desc: "FAQ và hướng dẫn", href: "#faq", icon: Headphones },
    ],
  },
  {
    label: "Kiếm tiền",
    items: [
      { title: "Chia sẻ giọng cộng đồng", desc: "Nhận thưởng giới thiệu", href: "/referral", icon: Gift },
      { title: "Chương trình Affiliate", desc: "Hoa hồng đối tác", href: "/referral", icon: CircleDollarSign },
    ],
  },
];

const faqs = [
  {
    q: "Gói theo tháng và theo năm khác nhau như thế nào?",
    a: "Gói theo tháng linh hoạt, phù hợp dùng ngắn hạn. Gói theo năm có cùng bộ tính năng nhưng tổng chi phí thấp hơn và thời lượng được cấp theo năm.",
  },
  {
    q: "Hết số phút xử lý thì có dùng tiếp được không?",
    a: "Bạn vẫn vào được tài khoản và xem lịch sử. Để xử lý file mới, bạn cần nâng cấp gói hoặc mua thêm phút xử lý.",
  },
  {
    q: "Có thể xuất file Word không?",
    a: "Có. Từ gói Basic trở lên có thể xuất DOCX/TXT; gói Pro hỗ trợ thêm định dạng phục vụ chia sẻ và lưu trữ.",
  },
  {
    q: "Doanh nghiệp có thể tích hợp API không?",
    a: "Có. Gói Business được thiết kế cho nhu cầu API, quản lý đội nhóm, bảo mật và hỗ trợ triển khai riêng.",
  },
  {
    q: "Có hoàn tiền khi không dùng hết phút không?",
    a: "Chính sách hoàn tiền và thời hạn sử dụng được áp dụng theo điều khoản dịch vụ tại thời điểm khách hàng đăng ký gói cước.",
  },
];

const featureGroups: Array<{
  title: string;
  rows: Array<{ feature: string; free: CompareValue; basic: CompareValue; pro: CompareValue; business: CompareValue }>;
}> = [
  {
    title: "Dung lượng và xử lý",
    rows: [
      { feature: "Thời lượng xử lý", free: "30 phút/tháng", basic: "300 phút/tháng", pro: "1.200 phút/tháng", business: "Tùy chỉnh" },
      { feature: "Kích thước file tối đa", free: "50MB", basic: "200MB", pro: "1GB", business: "Theo cấu hình" },
      { feature: "Tốc độ xử lý ưu tiên", free: false, basic: false, pro: true, business: true },
      { feature: "Nhận diện nhiều người nói", free: false, basic: false, pro: true, business: true },
    ],
  },
  {
    title: "Tính năng transcript",
    rows: [
      { feature: "Copy văn bản", free: true, basic: true, pro: true, business: true },
      { feature: "Xuất TXT", free: false, basic: true, pro: true, business: true },
      { feature: "Xuất DOCX", free: false, basic: true, pro: true, business: true },
      { feature: "Xuất PDF", free: false, basic: false, pro: true, business: true },
      { feature: "Lưu lịch sử", free: "7 ngày", basic: "30 ngày", pro: "Không giới hạn", business: "Theo hợp đồng" },
    ],
  },
  {
    title: "Quản trị và hỗ trợ",
    rows: [
      { feature: "Tài khoản đội nhóm", free: false, basic: false, pro: false, business: true },
      { feature: "API tích hợp", free: false, basic: false, pro: false, business: true },
      { feature: "Hỗ trợ email", free: false, basic: true, pro: true, business: true },
      { feature: "Hỗ trợ ưu tiên", free: false, basic: false, pro: true, business: true },
    ],
  },
];

function PricingPage() {
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [planMessage, setPlanMessage] = useState("");
  const [upgradingPlan, setUpgradingPlan] = useState("");
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const pendingPurchaseStarted = useRef(false);
  const plans = billing === "monthly" ? monthlyPlans : yearlyPlans;

  useEffect(() => {
    if (!user || !token || pendingPurchaseStarted.current) return;

    const pending = getPendingPlanPurchase();
    if (!pending) return;

    pendingPurchaseStarted.current = true;
    setBilling(pending.billingCycle);
    setUpgradingPlan(pending.planName);
    setPlanMessage(`Đang đăng ký gói ${pending.planName} đã chọn trước đó...`);

    async function completePendingPurchase() {
      try {
        const checkout = await createCheckout(
          token,
          pending.plan,
          pending.billingCycle,
        );
        clearPendingPlanPurchase();
        void navigate({
          to: "/checkout/$orderId",
          params: { orderId: checkout.order.id },
        });
      } catch (error) {
        pendingPurchaseStarted.current = false;
        setPlanMessage(
          error instanceof Error
            ? error.message
            : "Không tạo được đơn hàng. Vui lòng bấm chọn gói lại.",
        );
      } finally {
        setUpgradingPlan("");
      }
    }

    void completePendingPurchase();
  }, [navigate, token, user]);

  function handleStart() {
    if (user) {
      void navigate({ to: "/upload" });
      return;
    }

    void navigate({ to: "/login", search: { error: undefined, from: "/pricing" } });
  }

  async function handleSelectPlan(plan: Plan) {
    setPlanMessage("");

    if (plan.code === "business") {
      document.getElementById("enterprise")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (!user || !token) {
      if (plan.code === "standard" || plan.code === "special") {
        savePendingPlanPurchase(plan.code, billing, plan.name);
      }
      void navigate({ to: "/login", search: { error: undefined, from: "/pricing" } });
      return;
    }

    if (plan.code === "free") {
      void navigate({ to: "/upload" });
      return;
    }

    setUpgradingPlan(plan.name);
    try {
      if (plan.code !== "standard" && plan.code !== "special") {
        setPlanMessage("Gói này chưa hỗ trợ thanh toán tự động");
        return;
      }

      const checkout = await createCheckout(token, plan.code, billing);
      void navigate({
        to: "/checkout/$orderId",
        params: { orderId: checkout.order.id },
      });
    } catch (error) {
      setPlanMessage(
        error instanceof Error ? error.message : "Không tạo được đơn hàng",
      );
    } finally {
      setUpgradingPlan("");
    }
  }

  return (
    <main className="min-h-screen bg-white text-[#21104a]">
      <PricingHeader onStart={handleStart} />
      <PricingHero billing={billing} setBilling={setBilling} />
      {planMessage && (
        <div className="mx-auto mb-6 max-w-4xl px-4 md:px-6">
          <div className="rounded-2xl border border-[#ffcb05]/50 bg-white px-5 py-4 text-center text-sm font-black text-[#21104a] shadow-[0_16px_55px_rgba(33,16,74,.08)]">
            {planMessage}
          </div>
        </div>
      )}
      <PlanCards
        plans={plans}
        billing={billing}
        upgradingPlan={upgradingPlan}
        onSelectPlan={(plan) => void handleSelectPlan(plan)}
      />
      <PricingValueBand />
      <CompareTable billing={billing} setBilling={setBilling} />
      <PricingFaq />
      <EnterpriseCta onStart={handleStart} />
      <PricingFooter />
    </main>
  );
}

function PricingHeader({ onStart }: { onStart: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[#ece6ff] bg-white/92 shadow-[0_10px_35px_rgba(33,16,74,.05)] backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
        <Link to="/" className="flex items-center" aria-label="Vbee AIVoice">
          <VbeeBrandLogo />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {pricingNavigation.map((group) => (
            <div key={group.label} className="group relative">
              <button className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-black text-[#21104a] transition hover:bg-[#f1eef7]">
                {group.label} <ChevronDown className="h-4 w-4 transition group-hover:rotate-180" />
              </button>
              <div className="invisible absolute left-0 top-full z-40 w-[320px] translate-y-3 rounded-[1.5rem] border border-[#eee8ff] bg-white p-3 opacity-0 shadow-[0_24px_80px_rgba(33,16,74,.18)] transition group-hover:visible group-hover:translate-y-2 group-hover:opacity-100">
                {group.items.map((item) => (
                  <a key={item.title} href={item.href} className="flex gap-3 rounded-2xl p-3 transition hover:bg-[#f8f5ff]">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#fff3a6] text-[#21104a]">
                      <item.icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-black text-[#21104a]">{item.title}</span>
                      <span className="mt-0.5 block text-xs font-semibold leading-5 text-[#756894]">{item.desc}</span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ))}
          <span className="rounded-full bg-[#fff2a3] px-4 py-2 text-sm font-black text-[#21104a] shadow-inner">Bảng giá</span>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <button onClick={onStart} className="rounded-full px-4 py-2 text-sm font-black text-[#21104a] transition hover:bg-[#f1eef7]">Đăng nhập</button>
          <button onClick={onStart} className="inline-flex items-center gap-2 rounded-full bg-[#ffcb05] px-5 py-2.5 text-sm font-black text-[#21104a] shadow-[0_12px_30px_rgba(255,203,5,.35)] transition hover:-translate-y-0.5 hover:bg-[#ffdc45]">
            Dùng thử <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <button onClick={() => setMobileOpen((v) => !v)} className="grid h-11 w-11 place-items-center rounded-full bg-[#f2f0f7] text-[#21104a] lg:hidden" aria-label="Mở menu">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="border-t border-[#eee8ff] bg-white px-4 py-4 lg:hidden">
          <div className="space-y-3">
            {pricingNavigation.map((group) => (
              <details key={group.label} className="rounded-2xl bg-[#f8f5ff] p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between font-black text-[#21104a]">
                  {group.label} <ChevronDown className="h-4 w-4" />
                </summary>
                <div className="mt-3 grid gap-2">
                  {group.items.map((item) => (
                    <a key={item.title} href={item.href} onClick={() => setMobileOpen(false)} className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-[#37235f]">
                      {item.title}
                    </a>
                  ))}
                </div>
              </details>
            ))}
            <div className="block rounded-2xl bg-[#fff2a3] px-4 py-3 font-black text-[#21104a]">Bảng giá</div>
            <button onClick={onStart} className="w-full rounded-2xl bg-[#ffcb05] px-5 py-3 font-black text-[#21104a]">Bắt đầu miễn phí</button>
          </div>
        </div>
      )}
    </header>
  );
}
function PricingHero({
  billing,
  setBilling,
}: {
  billing: BillingCycle;
  setBilling: (billing: BillingCycle) => void;
}) {
  return (
    <section className="relative overflow-hidden bg-[#21104a] px-4 pb-10 pt-10 text-white md:px-6 md:pb-14 md:pt-12">
      <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-[#ffcb05]/20 blur-3xl" />
      <div className="absolute right-[12%] top-20 h-52 w-52 rounded-full bg-[#6c45ae]/45 blur-3xl" />
      <div className="absolute inset-0 opacity-20 vbee-foundation-grid" />

      <div className="relative mx-auto max-w-7xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#ffdc45]">
          <Sparkles className="h-4 w-4 text-[#ffcb05]" /> Bảng giá dịch vụ
        </div>
        <h1 className="mx-auto mt-5 max-w-3xl text-2xl font-black leading-tight tracking-tight text-white md:text-3xl lg:text-4xl">
          Chọn gói Vbee AIVoice phù hợp với nhu cầu của bạn
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/72">
          Chọn gói theo thời lượng xử lý, nhu cầu xuất dữ liệu và mức độ hỗ trợ.
          Bạn có thể chuyển giữa giá theo tháng và theo năm.
        </p>

        <BillingToggle billing={billing} setBilling={setBilling} className="mt-8" />

        <div className="mx-auto mt-6 grid max-w-3xl gap-3 text-left md:grid-cols-3">
          {[
            [Clock3, "Linh hoạt", "Nâng cấp hoặc đổi gói theo nhu cầu xử lý."],
            [ShieldCheck, "Bảo mật", "Lịch sử và file được gắn với tài khoản đăng nhập."],
            [Gift, "Tiết kiệm", "Gói năm phù hợp người dùng thường xuyên."],
          ].map(([Icon, title, desc]) => {
            const TypedIcon = Icon as typeof Clock3;
            return (
              <div key={String(title)} className="rounded-2xl border border-white/15 bg-white/10 p-4">
                <TypedIcon className="h-5 w-5 text-[#ffcb05]" />
                <p className="mt-3 font-black text-white">{title as string}</p>
                <p className="mt-1 text-xs leading-5 text-white/65">{desc as string}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BillingToggle({
  billing,
  setBilling,
  className = "",
}: {
  billing: BillingCycle;
  setBilling: (billing: BillingCycle) => void;
  className?: string;
}) {
  const itemClass = "relative z-10 rounded-full px-5 py-2.5 text-[13px] font-black transition md:px-7";

  return (
    <div className={`inline-flex rounded-full border border-[#e8decc] bg-white p-1 shadow-[0_16px_45px_rgba(33,16,74,.08)] ${className}`}>
      <button
        type="button"
        onClick={() => setBilling("monthly")}
        className={`${itemClass} ${billing === "monthly" ? "bg-[#21104a] text-white shadow-[0_10px_30px_rgba(33,16,74,.22)]" : "text-[#6a5a8f] hover:text-[#21104a]"}`}
      >
        Theo tháng
      </button>
      <button
        type="button"
        onClick={() => setBilling("yearly")}
        className={`${itemClass} ${billing === "yearly" ? "bg-[#ffcb05] text-[#21104a] shadow-[0_10px_30px_rgba(255,203,5,.32)]" : "text-[#6a5a8f] hover:text-[#21104a]"}`}
      >
        Theo năm <span className="ml-1 hidden rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-black text-[#7a5d00] sm:inline">tiết kiệm</span>
      </button>
    </div>
  );
}

function PlanCards({
  plans,
  billing,
  upgradingPlan,
  onSelectPlan,
}: {
  plans: Plan[];
  billing: BillingCycle;
  upgradingPlan: string;
  onSelectPlan: (plan: Plan) => void;
}) {
  return (
    <section id="plans" className="px-4 pb-12 md:px-6 md:pb-14">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[#9a7b00]">
              {billing === "monthly" ? "Bảng giá theo tháng" : "Bảng giá theo năm"}
            </p>
            <h2 className="mt-2 text-xl font-black text-[#21104a] md:text-3xl">
              {billing === "monthly" ? "Thanh toán linh hoạt hàng tháng" : "Thanh toán năm tiết kiệm hơn"}
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-[#6a5a8f]">
            Mỗi gói gồm số phút xử lý, giới hạn file và quyền xuất dữ liệu khác nhau.
            Gói được đề xuất phù hợp với người dùng cần xử lý thường xuyên.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-4">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`relative flex min-h-[460px] flex-col rounded-2xl border p-5 shadow-[0_14px_45px_rgba(33,16,74,.06)] transition hover:-translate-y-1 ${
                plan.highlight
                  ? "border-[#ffcb05] bg-[#21104a] text-white shadow-[0_20px_70px_rgba(33,16,74,.18)]"
                  : "border-[#eee4d3] bg-white text-[#21104a]"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#ffcb05] px-4 py-1.5 text-xs font-black text-[#21104a] shadow-[0_10px_30px_rgba(255,203,5,.35)]">
                  {plan.badge}
                </div>
              )}

              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${plan.highlight ? "bg-white/10 text-[#ffcb05]" : "bg-[#fff7c2] text-[#725a00]"}`}>
                    {plan.label}
                  </span>
                  <h3 className="mt-5 text-2xl font-black">{plan.name}</h3>
                </div>
                <div className={`grid h-11 w-11 place-items-center rounded-2xl ${plan.highlight ? "bg-[#ffcb05] text-[#21104a]" : "bg-[#f7f3ff] text-[#21104a]"}`}>
                  {plan.highlight ? <Crown className="h-5 w-5" /> : <FileAudio className="h-5 w-5" />}
                </div>
              </div>

              <p className={`mt-4 min-h-[72px] text-sm leading-6 ${plan.highlight ? "text-white/70" : "text-[#6a5a8f]"}`}>{plan.desc}</p>

              <div className="mt-5 rounded-2xl border border-current/10 p-4">
                <p className={`text-xs font-bold ${plan.highlight ? "text-white/60" : "text-[#6a5a8f]"}`}>Thời lượng</p>
                <p className="mt-1 text-lg font-black">{plan.minutes}</p>
              </div>

              <div className="mt-6 flex items-end gap-1">
                <span className="text-2xl font-black tracking-tight md:text-3xl">{plan.price}</span>
                {plan.unit && <span className={`pb-1 text-sm font-bold ${plan.highlight ? "text-white/60" : "text-[#6a5a8f]"}`}>{plan.unit}</span>}
              </div>

              {plan.saving ? (
                <p className={`mt-2 text-xs font-black ${plan.highlight ? "text-[#ffcb05]" : "text-[#9a7b00]"}`}>{plan.saving}</p>
              ) : (
                <p className={`mt-2 text-xs ${plan.highlight ? "text-white/50" : "text-[#9b90ad]"}`}>Không phí cài đặt</p>
              )}

              <button
                onClick={() => onSelectPlan(plan)}
                disabled={upgradingPlan === plan.name}
                className={`mt-6 w-full rounded-full px-5 py-3 text-sm font-black transition ${
                  plan.highlight
                    ? "bg-[#ffcb05] text-[#21104a] hover:bg-[#ffd842]"
                    : "bg-[#21104a] text-white hover:bg-[#30116b]"
                } disabled:cursor-not-allowed disabled:opacity-65`}
              >
                {upgradingPlan === plan.name ? "Đang nâng cấp..." : plan.cta}
              </button>

              <div className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 text-sm font-semibold leading-6">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#17b26a]" />
                    <span className={plan.highlight ? "text-white/78" : "text-[#4d3c75]"}>{feature}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingValueBand() {
  const values = [
    { icon: Sparkles, title: "1000+ giọng AI", desc: "Khu giới thiệu năng lực giọng đọc, lồng tiếng và nhân bản giọng nói cho phiên bản mở rộng." },
    { icon: Clock3, title: "Tiết kiệm đến 90%", desc: "Nhấn mạnh lợi ích giảm thời gian ghi âm, xử lý nội dung và vận hành đội nhóm." },
    { icon: PlugZap, title: "API sẵn sàng mở rộng", desc: "Thiết kế UI đã có vị trí cho API, webhook, team workspace và gói doanh nghiệp." },
  ];

  return (
    <section className="bg-[#f7f5ff] px-4 py-10 md:px-6 md:py-12">
      <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
        {values.map((item) => (
          <div key={item.title} className="rounded-xl border border-[#eee4d3] bg-white p-5 shadow-[0_10px_35px_rgba(33,16,74,.05)]">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#21104a] text-[#ffcb05]">
              <item.icon className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-black text-[#21104a]">{item.title}</h3>
            <p className="mt-2 text-sm leading-7 text-[#6a5a8f]">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CompareTable({
  billing,
  setBilling,
}: {
  billing: BillingCycle;
  setBilling: (billing: BillingCycle) => void;
}) {
  const yearlyMultiplier = billing === "yearly";

  const getDisplayRows = featureGroups.map((group) => ({
    ...group,
    rows: group.rows.map((row) => {
      if (!yearlyMultiplier || row.feature !== "Thời lượng xử lý") return row;
      return {
        ...row,
        free: "360 phút/năm",
        basic: "3.600 phút/năm",
        pro: "14.400 phút/năm",
      };
    }),
  }));

  return (
    <section className="bg-white px-4 py-12 md:px-6 md:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#fff7c2] px-4 py-2 text-xs font-black uppercase tracking-wide text-[#725a00]">
              <BadgeCheck className="h-4 w-4" /> So sánh chi tiết
            </div>
            <h2 className="mt-4 text-2xl font-black text-[#21104a] md:text-3xl">Bảng so sánh tính năng</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#6a5a8f]">
              So sánh nhanh thời lượng, giới hạn file, xuất dữ liệu, API và hỗ trợ
              để chọn gói phù hợp trước khi thanh toán.
            </p>
          </div>
          <BillingToggle billing={billing} setBilling={setBilling} />
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-[#eee8ff] bg-white shadow-[0_14px_45px_rgba(33,16,74,.06)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-[#fbf8ef] text-[#21104a]">
                  <th className="w-[28%] px-5 py-5 text-xs font-black uppercase tracking-wide text-[#6a5a8f]">Tính năng</th>
                  <PlanHead name="Free" price={billing === "monthly" ? "0đ" : "0đ"} />
                  <PlanHead name="Tiêu chuẩn" price={billing === "monthly" ? "39.000đ" : "390.000đ"} />
                  <PlanHead name="Đặc biệt" price={billing === "monthly" ? "89.000đ" : "890.000đ"} highlight />
                  <PlanHead name="Business" price="Liên hệ" />
                </tr>
              </thead>
              <tbody>
                {getDisplayRows.map((group) => (
                  <FragmentGroup key={group.title} title={group.title} rows={group.rows} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-[#eee4d3] bg-[#fbf8ef] p-5 text-sm leading-7 text-[#6a5a8f]">
          <strong className="text-[#21104a]">Ghi chú:</strong> Giá, thời lượng và
          tính năng có thể thay đổi theo chính sách gói cước tại thời điểm đăng ký.
        </div>
      </div>
    </section>
  );
}

function PlanHead({ name, price, highlight = false }: { name: string; price: string; highlight?: boolean }) {
  return (
    <th className={`px-5 py-5 ${highlight ? "bg-[#21104a] text-white" : "text-[#21104a]"}`}>
      <div className="flex items-center gap-2">
        {highlight && <Star className="h-4 w-4 fill-[#ffcb05] text-[#ffcb05]" />}
        <span className="text-base font-black">{name}</span>
      </div>
      <p className={`mt-1 text-lg font-black ${highlight ? "text-[#ffcb05]" : "text-[#21104a]"}`}>{price}</p>
    </th>
  );
}

function FragmentGroup({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ feature: string; free: CompareValue; basic: CompareValue; pro: CompareValue; business: CompareValue }>;
}) {
  return (
    <>
      <tr>
        <td colSpan={5} className="border-t border-[#eee8ff] bg-[#f7f3ff] px-5 py-3 text-xs font-black uppercase tracking-wide text-[#21104a]">
          {title}
        </td>
      </tr>
      {rows.map((row, index) => (
        <tr key={row.feature} className={index % 2 === 0 ? "bg-white" : "bg-[#fcfbff]"}>
          <td className="border-t border-[#eee8ff] px-5 py-4 font-bold text-[#4d3c75]">{row.feature}</td>
          <CompareCell value={row.free} />
          <CompareCell value={row.basic} />
          <CompareCell value={row.pro} highlight />
          <CompareCell value={row.business} />
        </tr>
      ))}
    </>
  );
}

function CompareCell({ value, highlight = false }: { value: CompareValue; highlight?: boolean }) {
  if (typeof value === "boolean") {
    return (
      <td className={`border-t border-[#eee8ff] px-5 py-4 text-center ${highlight ? "bg-[#fffdf2]" : ""}`}>
        {value ? (
          <span className="inline-grid h-7 w-7 place-items-center rounded-full bg-[#ecfdf3] text-[#17b26a]">
            <Check className="h-4 w-4" />
          </span>
        ) : (
          <span className="inline-grid h-7 w-7 place-items-center rounded-full bg-[#f5f2ea] text-[#aaa0b9]">
            <Minus className="h-4 w-4" />
          </span>
        )}
      </td>
    );
  }

  return (
    <td className={`border-t border-[#eee8ff] px-5 py-4 text-center font-semibold text-[#4d3c75] ${highlight ? "bg-[#fffdf2]" : ""}`}>
      {value}
    </td>
  );
}

function PricingFaq() {
  return (
    <section id="faq" className="bg-[#f7f5ff] px-4 py-12 md:px-6 md:py-16">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-[#725a00] shadow-[0_12px_35px_rgba(33,16,74,.06)]">
            <HelpCircle className="h-4 w-4 text-[#ffcb05]" /> Câu hỏi thường gặp
          </div>
          <h2 className="mt-4 text-2xl font-black text-[#21104a] md:text-3xl">Giải đáp trước khi mua gói</h2>
        </div>

        <div className="mt-10 space-y-4">
          {faqs.map((item) => (
            <details key={item.q} className="group rounded-xl border border-[#eee4d3] bg-white p-4 shadow-[0_10px_32px_rgba(33,16,74,.05)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black text-[#21104a]">
                <span>{item.q}</span>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f7f3ff] text-[#21104a] transition group-open:rotate-180">
                  <ChevronDown className="h-5 w-5" />
                </span>
              </summary>
              <p className="mt-4 text-sm leading-7 text-[#6a5a8f]">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function EnterpriseCta({ onStart }: { onStart: () => void }) {
  return (
    <section id="enterprise" className="bg-white px-4 py-12 md:px-6 md:py-14">
      <div className="mx-auto grid max-w-7xl overflow-hidden rounded-2xl bg-[#21104a] text-white shadow-[0_20px_70px_rgba(33,16,74,.18)] lg:grid-cols-[1.05fr_.95fr]">
        <div className="relative p-6 md:p-8 lg:p-10">
          <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-[#ffcb05]/20 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#ffcb05]">
              <Headphones className="h-4 w-4" /> Tư vấn gói phù hợp
            </div>
            <h2 className="mt-5 text-2xl font-black leading-tight md:text-3xl">Doanh nghiệp cần số phút lớn hoặc tích hợp API?</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70">
              Vbee hỗ trợ tư vấn gói riêng cho đội nhóm có nhu cầu xử lý số phút
              lớn, tích hợp API hoặc yêu cầu vận hành đặc thù.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                [Zap, "SLA riêng"],
                [ShieldCheck, "Bảo mật"],
                [UploadCloud, "API tích hợp"],
              ].map(([Icon, label]) => {
                const TypedIcon = Icon as typeof Zap;
                return (
                  <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
                    <TypedIcon className="h-5 w-5 text-[#ffcb05]" />
                    <p className="mt-3 text-sm font-black">{label as string}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 text-[#21104a] md:p-6 lg:p-8">
          <div className="rounded-xl border border-[#eee8ff] bg-[#fbf8ef] p-5">
            <h3 className="text-2xl font-black">Nhận tư vấn bảng giá</h3>
            <p className="mt-2 text-sm leading-6 text-[#6a5a8f]">Để lại thông tin để Vbee tư vấn gói cước phù hợp với nhu cầu sử dụng.</p>
            <div className="mt-5 space-y-3">
              <input className="w-full rounded-2xl border border-[#e8decc] bg-white px-4 py-3 text-sm font-semibold text-[#21104a] outline-none transition focus:border-[#ffcb05]" placeholder="Họ và tên" />
              <input className="w-full rounded-2xl border border-[#e8decc] bg-white px-4 py-3 text-sm font-semibold text-[#21104a] outline-none transition focus:border-[#ffcb05]" placeholder="Email hoặc số điện thoại" />
              <textarea className="min-h-28 w-full rounded-2xl border border-[#e8decc] bg-white px-4 py-3 text-sm font-semibold text-[#21104a] outline-none transition focus:border-[#ffcb05]" placeholder="Nhu cầu xử lý mỗi tháng/năm" />
            </div>
            <button onClick={onStart} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#ffcb05] px-6 py-3 font-black text-[#21104a] transition hover:bg-[#ffd842]">
              Gửi yêu cầu tư vấn <ArrowRight className="h-4 w-4" />
            </button>
            <a href="mailto:vbee@gmail.com" className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-[#6a5a8f] hover:text-[#21104a]">
              <Mail className="h-4 w-4" /> vbee@gmail.com
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingFooter() {
  return (
    <footer className="bg-[#21104a] px-4 py-12 text-white md:px-6">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.1fr_.9fr_.9fr_.9fr]">
        <div>
          <img src={vbeeLogo} alt="Vbee" className="h-14 w-auto rounded-xl bg-white/95 p-1" />
          <p className="mt-5 max-w-sm text-sm leading-7 text-white/65">Vbee AIVoice — bảng giá theo tháng và theo năm cho nền tảng speech-to-text.</p>
        </div>
        {[
          ["Sản phẩm", ["Speech to Text", "Record", "History", "Export DOCX"]],
          ["Bảng giá", ["Free", "Tiêu chuẩn", "Đặc biệt", "Business"]],
          ["Liên hệ", ["vbee@gmail.com", "0916 168 475", "Vinh University", "Việt Nam"]],
        ].map(([title, links]) => (
          <div key={String(title)}>
            <h3 className="font-black text-[#ffcb05]">{title}</h3>
            <div className="mt-4 space-y-3 text-sm text-white/65">
              {(links as string[]).map((link) => <p key={link}>{link}</p>)}
            </div>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-10 max-w-7xl border-t border-white/10 pt-6 text-sm text-white/50">© 2026 Vbee AIVoice. All rights reserved.</div>
    </footer>
  );
}
