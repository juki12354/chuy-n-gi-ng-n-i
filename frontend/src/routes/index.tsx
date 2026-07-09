import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Building2,
  Captions,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Copy,
  Download,
  FileAudio,
  FileText,
  Gift,
  Globe2,
  Headphones,
  Languages,
  LockKeyhole,
  Mail,
  Menu,
  Mic2,
  Network,
  Phone,
  Play,
  PlugZap,
  Search,
  Settings2,
  Sparkles,
  Star,
  UploadCloud,
  Users,
  Video,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import vbeeLogo from "@/assets/vbee-logo.png";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vbee AI Speech Workspace — Agent-ready speech-to-text platform" },
      {
        name: "description",
        content:
          "Vbee AI Speech Workspace gom speech-to-text, realtime, transcript, translation, billing và giao diện Vbee trong một workspace thống nhất.",
      },
      { property: "og:title", content: "Vbee AI Speech Workspace" },
      {
        property: "og:description",
        content:
          "Một nền tảng AI chuyển audio/video/ghi âm/realtime thành transcript, bản dịch, subtitle và tài liệu có thể quản lý.",
      },
      { property: "og:image", content: vbeeLogo },
    ],
  }),
  component: LandingPage,
});

const navigation = [
  {
    label: "Sản phẩm",
    items: [
      { title: "Phiên âm AI", desc: "Audio/video thành văn bản", href: "#transcription", icon: FileText },
      { title: "Dịch thuật AI", desc: "Dịch transcript nhanh", href: "#translation", icon: Languages },
      { title: "Phụ đề & chú thích", desc: "Tạo SRT/VTT cho video", href: "#subtitles", icon: Captions },
      { title: "Vbee API", desc: "Tích hợp vào hệ thống", href: "/api", icon: PlugZap },
    ],
  },
  {
    label: "Công ty",
    items: [
      { title: "Về chúng tôi", desc: "Sứ mệnh sản phẩm", href: "#about", icon: Building2 },
      { title: "Liên hệ", desc: "Tư vấn triển khai", href: "#contact", icon: Mail },
      { title: "Yêu cầu hỗ trợ", desc: "Hỗ trợ kỹ thuật", href: "#faq", icon: Headphones },
    ],
  },
  {
    label: "Tài nguyên",
    items: [
      { title: "Blog", desc: "Kiến thức AI speech", href: "#resources", icon: BookOpen },
      { title: "Videos", desc: "Hướng dẫn sử dụng", href: "#resources", icon: Video },
      { title: "Tài liệu bán hàng", desc: "Thông tin giải pháp", href: "/pricing", icon: FileAudio },
      { title: "Trung tâm trợ giúp", desc: "FAQ và hướng dẫn", href: "#faq", icon: Headphones },
    ],
  },
  {
    label: "Kiếm tiền",
    items: [
      { title: "Chia sẻ giọng cộng đồng", desc: "Nhận thưởng giới thiệu", href: "#referral", icon: Gift },
      { title: "Chương trình Affiliate", desc: "Hoa hồng đối tác", href: "#referral", icon: CircleDollarSign },
    ],
  },
];

const coreCapabilities = [
  {
    icon: FileText,
    title: "Phiên âm AI",
    desc: "Chuyển âm thanh thành văn bản có dấu với độ chính xác cao cho bài giảng, họp, phỏng vấn.",
  },
  {
    icon: Languages,
    title: "Dịch thuật AI",
    desc: "Dịch bản ghi sang nhiều ngôn ngữ, giữ ngữ cảnh và thuật ngữ quan trọng.",
  },
  {
    icon: Captions,
    title: "Phụ đề và chú thích",
    desc: "Tạo phụ đề hoàn chỉnh cho video, hỗ trợ chỉnh thời gian và xuất file chuẩn.",
  },
  {
    icon: Wand2,
    title: "Phân tích AI",
    desc: "Tóm tắt nội dung, rút ý chính, phân tích cảm xúc và tạo ghi chú hành động.",
  },
  {
    icon: Settings2,
    title: "Trình chỉnh sửa",
    desc: "Sửa transcript trực tiếp trong trình duyệt, đồng bộ theo audio và timeline.",
  },
  {
    icon: Users,
    title: "Cộng tác nhóm",
    desc: "Chia sẻ dự án, phân quyền người xem, người sửa và quản lý file tập trung.",
  },
];

const platformFeatures = [
  { icon: LockKeyhole, title: "Bảo mật & tuân thủ", desc: "Luồng tài khoản, token và lịch sử theo người dùng; sẵn sàng nâng cấp HTTPS khi triển khai thật." },
  { icon: PlugZap, title: "API & tích hợp", desc: "Dễ mở rộng sang API để kết nối dashboard, CRM, LMS hoặc quy trình nội bộ." },
  { icon: BarChart3, title: "Quản trị hệ thống", desc: "Theo dõi lượt xử lý, lịch sử chuyển đổi, dung lượng và gói sử dụng." },
];

const productBlueprint = [
  {
    icon: Network,
    title: "Hệ giao diện Vbee thống nhất",
    desc: "Các màn Home, Upload, Record, Realtime, History, Pricing và Checkout dùng chung phong cách Vbee để không bị mỗi trang một kiểu.",
    tags: ["AppHeader", "QuotaPanel", "TranscriptCard"],
  },
  {
    icon: FileText,
    title: "Quy chuẩn thương hiệu Vbee",
    desc: "Màu tím đậm, vàng nổi bật, card bo tròn, trạng thái rõ ràng và support widget đều đi theo nhận diện Vbee.",
    tags: ["Màu Vbee", "Page patterns", "UI checklist"],
  },
  {
    icon: Bot,
    title: "AI Speech Workspace",
    desc: "Một workspace duy nhất cho upload audio/video, ghi âm, nói realtime, quản lý transcript, dịch và xuất tài liệu.",
    tags: ["Upload", "Record", "Realtime"],
  },
  {
    icon: CircleDollarSign,
    title: "Billing + quota rõ ràng",
    desc: "User mua gói qua Pricing -> Checkout -> Payment/Confirm -> cập nhật quota, giống luồng sản phẩm thật.",
    tags: ["Free", "Standard", "Business"],
  },
];

const vbeeSystemPillars = [
  {
    icon: BadgeCheck,
    title: "Foundations",
    desc: "Token màu tím/vàng, typography, radius, shadow và spacing dùng chung cho toàn bộ sản phẩm.",
  },
  {
    icon: Network,
    title: "Components",
    desc: "AppHeader, QuotaPanel, UploadDropzone, RecorderPanel, TranscriptCard, PricingCard và SupportWidget đi cùng một chuẩn.",
  },
  {
    icon: Settings2,
    title: "Patterns",
    desc: "Upload, ghi âm, realtime, lịch sử, checkout và hỗ trợ có cùng trạng thái empty/loading/error/success.",
  },
  {
    icon: Bot,
    title: "Agent-ready",
    desc: "Tên component, token và luồng thao tác rõ ràng để đội code hoặc AI có thể mở rộng mà không làm lệch giao diện.",
  },
];

const vbeeStyleTokens = [
  { name: "Primary", value: "#ffcb05", usage: "CTA, progress, điểm nhấn" },
  { name: "Purple", value: "#21104a", usage: "Header, hero, footer" },
  { name: "Card", value: "#2b155f", usage: "Panel tối, dashboard" },
  { name: "Surface", value: "#f8f5ff", usage: "Workspace sáng, form" },
];

const vbeeComponentRegistry = [
  ["AppHeader", "Logo, điều hướng, active page, mobile menu"],
  ["QuotaPanel", "Gói cước, thời gian còn lại, cảnh báo hết quota"],
  ["UploadWorkspace", "Dropzone, file type, giới hạn dung lượng, process"],
  ["RecorderPanel", "Mic permission, timer, audio level, transcribe"],
  ["TranscriptCard", "Nội dung, trạng thái, copy/export/save"],
  ["SupportWidget", "Home, Messages, Chat, Help dùng chung"],
];

const vbeeEcosystem = [
  { icon: Mic2, title: "Speech Workspace", desc: "Không gian tạo transcript từ upload, ghi âm và realtime, sau đó chỉnh sửa, lưu lịch sử và xuất tài liệu." },
  { icon: Network, title: "Provider Hub", desc: "Sẵn sàng nối Vbee, Deepgram, Sonix hoặc provider khác qua backend adapter và health check." },
  { icon: Captions, title: "Subtitle & Translation", desc: "Mở rộng transcript thành bản dịch, phụ đề SRT/VTT và nội dung song ngữ." },
  { icon: Users, title: "Team Transcript", desc: "Định hướng cho doanh nghiệp: chia sẻ transcript, phân quyền, quản lý file theo workspace." },
  { icon: Headphones, title: "Customer Support Flow", desc: "Bảng hỗ trợ khách hàng dùng chung trên upload, record, realtime và pricing, tránh trùng nút support." },
];

const workflowSteps = [
  { title: "Đăng nhập và xem quota", desc: "User vào workspace, thấy ngay gói đang dùng, thời gian còn lại và nút bắt đầu phù hợp.", icon: Users },
  { title: "Chọn nguồn đầu vào", desc: "Tải audio/video, ghi âm trong trình duyệt hoặc nói realtime tùy tình huống làm việc.", icon: UploadCloud },
  { title: "AI tạo transcript", desc: "Hệ thống kiểm tra file/quota, ước tính thời gian xử lý và trả về văn bản có timeline.", icon: Bot },
  { title: "Chỉnh sửa và dịch", desc: "Người dùng sửa transcript, dịch sang ngôn ngữ khác, tạo phụ đề hoặc chuẩn bị bản xuất.", icon: Languages },
  { title: "Lưu, xuất và nâng cấp", desc: "Transcript được lưu vào lịch sử, có thể copy/export; nếu gần hết quota thì đi đến bảng giá.", icon: CircleDollarSign },
];

const referralSteps = [
  {
    title: "Tạo và gửi liên kết giới thiệu",
    desc: "Sao chép đường link liên kết hoặc mã giới thiệu và chia sẻ đến mọi người.",
    tag: "Liên kết giới thiệu",
    visual: "https://vbee.vn/ref/DVBWEOAZ",
    icon: Copy,
  },
  {
    title: "Người dùng mới tham gia từ liên kết giới thiệu",
    desc: "Bạn bè đăng ký tài khoản qua mã hoặc từ liên kết giới thiệu để kích hoạt ưu đãi.",
    tag: "Đăng ký ngay",
    visual: "Click",
    icon: Users,
  },
  {
    title: "Nhận thưởng",
    desc: "Mỗi lượt đăng ký thành công giúp bạn nhận 5.000 điểm miễn phí, còn bạn bè nhận 8.000 điểm khi tạo tài khoản.",
    tag: "5.000 điểm",
    visual: "8.000 điểm",
    icon: Gift,
  },
];

const rewardMilestones = [
  { title: "Tích lũy đến 1.000.000", reward: "+100.000 điểm" },
  { title: "Tích lũy đến 2.000.000", reward: "+200.000 điểm" },
  { title: "Tích lũy đến 5.000.000", reward: "+500.000 điểm" },
];

const referralTestimonials = [
  {
    name: "Minh Hoàng",
    role: "Kinh doanh tự do",
    quote:
      "Vbee là công cụ không thể thiếu trong công việc của tôi. Chương trình giới thiệu bạn bè là một cách tuyệt vời để vừa tiết kiệm chi phí, vừa chia sẻ công nghệ tuyệt vời này đến bạn bè.",
  },
  {
    name: "Hà Linh",
    role: "Content creator",
    quote:
      "Tôi dùng transcript và giọng đọc AI hằng ngày. Mã giới thiệu giúp tôi mời đồng nghiệp dùng thử nhanh hơn và nhận thêm điểm để xử lý nhiều nội dung hơn.",
  },
];

const productShowcases = [
  {
    id: "transcription",
    eyebrow: "Speech to Text",
    title: "Phiên âm audio/video thành văn bản rõ ràng",
    desc: "Workspace mô phỏng Sonix: upload bên trái, transcript ở giữa, công cụ tìm kiếm và xuất file bên phải. Giao diện dùng tím đậm và vàng nổi bật như Vbee.",
    icon: FileText,
    points: ["Nhận diện tiếng Việt", "Timeline theo từng câu", "Tìm kiếm trong transcript"],
  },
  {
    id: "translation",
    eyebrow: "AI Translation",
    title: "Dịch bản ghi nhanh cho nội dung đa ngôn ngữ",
    desc: "Từ một bản ghi gốc, người dùng có thể tạo phiên bản dịch để phục vụ học tập, họp quốc tế hoặc nội dung marketing.",
    icon: Languages,
    points: ["Dịch nhanh nhiều ngôn ngữ", "Giữ bố cục đoạn", "Xuất bản song ngữ"],
  },
  {
    id: "subtitles",
    eyebrow: "Subtitles",
    title: "Tạo phụ đề cho video trong vài thao tác",
    desc: "Sinh phụ đề từ transcript, chỉnh thời gian và xuất SRT/VTT để đăng YouTube, TikTok, Facebook hoặc LMS.",
    icon: Captions,
    points: ["SRT/VTT", "Chỉnh timing", "Tối ưu video ngắn"],
  },
  {
    id: "api",
    eyebrow: "Vbee API",
    title: "Kết nối năng lực phiên âm vào sản phẩm của bạn",
    desc: "Thiết kế sẵn khu vực API để sau này nối backend, phân quyền, dashboard usage và thanh toán gói doanh nghiệp.",
    icon: PlugZap,
    points: ["Webhook", "Quản lý token", "Mở rộng doanh nghiệp"],
  },
];

const faqs = [
  ["Tôi có thể lấy đường link hoặc mã giới thiệu ở đâu?", "Sau khi đăng nhập, bạn vào khu vực giới thiệu bạn bè để sao chép đường link hoặc mã giới thiệu cá nhân."],
  ["Tôi có thể nhận tối đa bao nhiêu điểm?", "Điểm thưởng phụ thuộc vào số người đăng ký và mua gói qua liên kết của bạn. Càng giới thiệu nhiều, tổng điểm tích lũy càng lớn."],
  ["Các mốc thưởng theo tổng giá trị đơn hàng là gì?", "Khi người được giới thiệu mua gói lần đầu, hệ thống cộng thêm điểm theo mốc tích lũy, ví dụ 1.000.000, 2.000.000 hoặc 5.000.000 điểm."],
  ["Điều kiện nào để người giới thiệu được nhận thưởng?", "Người được giới thiệu cần đăng ký bằng đúng liên kết hoặc mã của bạn. Với thưởng mua gói, đơn hàng đầu tiên cần được thanh toán thành công."],
  ["Tôi có thể xem tổng điểm thưởng mình đã nhận được ở đâu?", "Bạn có thể xem trong dashboard tài khoản, mục quota/điểm thưởng hoặc lịch sử giới thiệu khi tính năng này được bật."],
  ["Tôi có thể thay đổi hoặc reset mã giới thiệu của mình không?", "Mã giới thiệu mặc định được giữ ổn định để theo dõi chính xác. Nếu cần đổi mã, bạn có thể gửi yêu cầu hỗ trợ."],
  ["Làm sao để tôi ưu nhận thưởng?", "Hãy chia sẻ liên kết cho đúng nhóm người có nhu cầu dùng speech-to-text, ghi âm, chuyển audio/video thành văn bản hoặc mua gói xử lý nội dung."],
];

function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  function startApp() {
    if (user) {
      void navigate({ to: "/dashboard", search: { token: undefined } });
      return;
    }
    void navigate({ to: "/login", search: { error: undefined, from: undefined } });
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f4ff] text-[#191027]">
      <Header onStart={startApp} />
      <Hero onStart={startApp} />
      <TrustedStrip />
      <ProductBlueprint onStart={startApp} />
      <VbeeSystemSection onStart={startApp} />
      <CoreCapabilities onStart={startApp} />
      <VbeeEcosystem onStart={startApp} />
      <WorkspacePreview onStart={startApp} />
      <ProductShowcase onStart={startApp} />
      <Workflow onStart={startApp} />
      <Resources />
      <ContactCta onStart={startApp} />
      <Referral onStart={startApp} />
      <Faq />
      <Footer />
    </main>
  );
}

function Header({ onStart }: { onStart: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[#ece6ff] bg-white/92 shadow-[0_10px_35px_rgba(33,16,74,.05)] backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
        <Link to="/" className="flex items-center gap-2" aria-label="Vbee AIVoice">
          <img src={vbeeLogo} alt="Vbee AIVoice" className="h-11 w-auto object-contain md:h-12" />
          <span className="hidden text-[13px] font-black uppercase tracking-tight text-[#21104a] sm:inline">AIVoice</span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {navigation.map((group) => (
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
                      <span className="block text-[15px] font-black text-[#21104a]">{item.title}</span>
                      <span className="mt-0.5 block text-xs font-semibold leading-5 text-[#756894]">{item.desc}</span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ))}
          <Link to="/pricing" className="rounded-full px-4 py-2 text-sm font-black text-[#21104a] transition hover:bg-[#f1eef7]">Bảng giá</Link>
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
            {navigation.map((group) => (
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
            <Link to="/pricing" onClick={() => setMobileOpen(false)} className="block rounded-2xl bg-[#f8f5ff] px-4 py-3 font-black text-[#21104a]">Bảng giá</Link>
            <button onClick={onStart} className="w-full rounded-2xl bg-[#ffcb05] px-5 py-3 font-black text-[#21104a]">Bắt đầu miễn phí</button>
          </div>
        </div>
      )}
    </header>
  );
}

function Hero({ onStart }: { onStart: () => void }) {
  return (
    <section className="relative bg-[#21104a] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_12%,rgba(255,203,5,.28),transparent_25%),radial-gradient(circle_at_88%_15%,rgba(122,90,255,.32),transparent_28%),linear-gradient(135deg,#16072d_0%,#21104a_48%,#391676_100%)]" />
      <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 md:px-6 md:py-18 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:py-20">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#ffcb05] backdrop-blur">
            <Sparkles className="h-4 w-4" /> Vbee AI Speech Workspace
          </div>
          <h1 className="mt-5 max-w-2xl text-[2.45rem] font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-[4.6rem]">
            Chuyển giọng nói thành <span className="text-[#ffcb05]">văn bản AI</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-white/76 md:text-lg">
            Tải file, ghi âm hoặc nói realtime để tạo transcript, dịch nội dung, xuất tài liệu và quản lý gói cước trong một workspace Vbee thống nhất.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button onClick={onStart} className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#ffcb05] px-7 py-4 text-base font-black text-[#21104a] shadow-[0_18px_55px_rgba(255,203,5,.32)] transition hover:-translate-y-1 hover:bg-[#ffdc45]">
              Vào AI Workspace <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
            </button>
            <a href="#workspace" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-7 py-4 text-base font-bold text-white backdrop-blur transition hover:bg-white/15">
              <Play className="h-5 w-5" /> Xem giao diện studio
            </a>
          </div>
          <div className="mt-10 grid max-w-xl grid-cols-3 gap-3 text-center">
            {[["1", "workspace"], ["3", "nguồn vào"], ["Vbee", "nhận diện"]].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur">
                <div className="text-xl font-black text-[#ffcb05] md:text-3xl">{value}</div>
                <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-white/62">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <HeroStudioMock />
      </div>
    </section>
  );
}

function HeroStudioMock() {
  return (
    <div className="relative mx-auto w-full max-w-[650px]">
      <div className="absolute -inset-6 rounded-[3rem] bg-[#ffcb05]/15 blur-3xl" />
      <div className="relative overflow-hidden rounded-[2.1rem] border border-white/14 bg-white p-3 text-[#21104a] shadow-[0_35px_100px_rgba(0,0,0,.36)] md:p-4">
        <div className="rounded-[1.65rem] bg-[#f8f7fb] p-4">
          <div className="flex items-center justify-between rounded-[1.4rem] bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <Menu className="h-6 w-6 text-[#4c3f68]" />
              <img src={vbeeLogo} alt="logo" className="h-9 w-auto" />
              <span className="hidden text-sm font-black md:inline">AI Speech Workspace</span>
            </div>
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-[#21104a]" />
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#ffcb05] text-sm font-black">M</span>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_.42fr]">
            <div className="rounded-[1.4rem] bg-white p-4 shadow-sm">
              <p className="text-sm font-black text-[#aaa4b7]">Project: board meeting transcript</p>
              <div className="mt-4 rounded-2xl bg-[#f1eff7] p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-[#21104a] text-[#ffcb05]"><Mic2 className="h-5 w-5" /></div>
                  <div>
                    <p className="font-black text-[#21104a]">Upload + Record + Realtime</p>
                    <p className="text-xs font-bold text-[#756894]">Một pipeline, một history, một quota</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-4 border-t border-[#ded8ef] pt-3 text-[#34265d]">
                  <Clock3 className="h-5 w-5" />
                  <Globe2 className="h-5 w-5" />
                  <UploadCloud className="h-5 w-5" />
                  <Search className="h-5 w-5" />
                  <span className="ml-auto rounded-full bg-white px-3 py-1 text-xs font-black">Vbee style</span>
                </div>
              </div>
              <div className="mt-4 rounded-2xl bg-white p-2 text-[15px] leading-8 text-[#9288a7]">
                Hệ giao diện Vbee giúp các màn upload, ghi âm, realtime, lịch sử, bảng giá và checkout đi cùng một trải nghiệm thống nhất, rõ ràng và dễ dùng.
              </div>
              <div className="mt-4 flex h-16 items-end gap-1.5 rounded-2xl bg-[#21104a] px-4 py-3">
                {[30, 62, 45, 76, 38, 88, 55, 70, 42, 94, 48, 66, 34, 82, 52, 73, 40, 64].map((height, index) => (
                  <span key={index} className="w-full rounded-full bg-[#ffcb05] animate-wave" style={{ height: `${height}%`, animationDelay: `${index * 0.05}s` }} />
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              {[
                { title: "Upload", value: "MP3/MP4", icon: UploadCloud },
                { title: "Realtime", value: "Live", icon: Mic2 },
                { title: "Billing", value: "Quota", icon: CircleDollarSign },
              ].map((stat) => (
                <div key={stat.title} className="rounded-2xl bg-white p-4 shadow-sm">
                  <stat.icon className="h-5 w-5 text-[#ffcb05]" />
                  <p className="mt-3 text-xs font-bold text-[#756894]">{stat.title}</p>
                  <p className="text-2xl font-black text-[#21104a]">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 left-8 hidden rounded-2xl bg-[#ffcb05] px-5 py-3 text-sm font-black text-[#21104a] shadow-xl md:block">+ Vbee workspace</div>
      <div className="absolute -right-4 top-12 hidden rounded-2xl border border-[#eee8ff] bg-white px-5 py-3 text-sm font-black text-[#21104a] shadow-xl md:block">Vbee UI</div>
    </div>
  );
}

function TrustedStrip() {
  return (
    <section className="bg-[#ffcb05] px-4 py-6 text-[#21104a] md:px-6">
      <div className="mx-auto grid max-w-7xl gap-4 text-center md:grid-cols-4">
        {[
          ["Workspace", "Upload, Record, Realtime"],
          ["Vbee UI", "Giao diện đồng bộ"],
          ["Provider hub", "Vbee, Deepgram, Sonix-ready"],
          ["Billing", "Pricing, Checkout, Quota"],
        ].map(([title, desc]) => (
          <div key={title} className="rounded-2xl bg-white/35 px-4 py-4">
            <div className="font-black">{title}</div>
            <div className="mt-1 text-xs font-bold opacity-70">{desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductBlueprint({ onStart }: { onStart: () => void }) {
  return (
    <section id="blueprint" className="bg-white px-4 py-16 md:px-6 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[.82fr_1.18fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#21104a] px-4 py-2 text-xs font-black uppercase tracking-wide text-[#ffcb05]">
              <BadgeCheck className="h-4 w-4" /> Vbee product workspace
            </div>
            <h2 className="mt-5 text-3xl font-black leading-tight text-[#21104a] md:text-5xl">
              Không còn là một landing page rời rạc, đây là bản sản phẩm hợp nhất
            </h2>
            <p className="mt-5 text-base leading-8 text-[#6a5a8f]">
              Vbee định hướng sản phẩm thành một workspace speech-to-text thống nhất: có upload, ghi âm, realtime, transcript, dịch, gói cước và provider API, đồng thời giữ màu sắc và trải nghiệm thương hiệu Vbee.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button onClick={onStart} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ffcb05] px-6 py-3 font-black text-[#21104a] shadow-[0_14px_38px_rgba(255,203,5,.28)] transition hover:-translate-y-0.5 hover:bg-[#ffd842]">
                Dùng workspace <ArrowRight className="h-4 w-4" />
              </button>
              <a href="#workspace" className="inline-flex items-center justify-center gap-2 rounded-full border border-[#21104a]/10 bg-white px-6 py-3 font-black text-[#21104a] transition hover:bg-[#f8f5ff]">
                Xem studio
              </a>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {productBlueprint.map((item) => (
              <article key={item.title} className="rounded-[1.6rem] border border-[#eee8ff] bg-[#fbfaff] p-5 shadow-[0_16px_55px_rgba(33,16,74,.07)]">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#21104a] text-[#ffcb05]">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-xl font-black text-[#21104a]">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#6a5a8f]">{item.desc}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#21104a] shadow-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function VbeeSystemSection({ onStart }: { onStart: () => void }) {
  return (
    <section id="vbee-system" className="vbee-page-band vbee-foundation-grid px-4 py-16 md:px-6 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
          <div className="vbee-surface p-6 md:p-8">
            <span className="vbee-chip">
              <Sparkles className="h-4 w-4" /> Vbee design system
            </span>
            <h2 className="mt-5 text-3xl font-black leading-tight text-[#21104a] md:text-5xl">
              Giao diện được gom thành một hệ thống, không còn mỗi trang một kiểu
            </h2>
            <p className="mt-5 text-base leading-8 text-[#6a5a8f]">
              Các màn upload, ghi âm, realtime, lịch sử, bảng giá và hỗ trợ dùng chung foundation, component và pattern. Cách này giúp code dễ mở rộng, dễ bàn giao và giữ đúng nhận diện Vbee.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button onClick={onStart} className="vbee-button-primary px-6 py-3">
                Vào workspace <ArrowRight className="h-4 w-4" />
              </button>
              <a href="#workflow" className="vbee-button-secondary px-6 py-3">
                Xem luồng xử lý
              </a>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {vbeeStyleTokens.map((token) => (
                <div key={token.name} className="vbee-token-card">
                  <div className="flex items-center gap-3">
                    <span className="h-11 w-11 rounded-2xl border border-[#21104a]/10 shadow-inner" style={{ background: token.value }} />
                    <div>
                      <div className="text-sm font-black text-[#21104a]">{token.name}</div>
                      <div className="text-xs font-bold text-[#756894]">{token.value}</div>
                    </div>
                  </div>
                  <p className="mt-3 text-xs font-semibold leading-5 text-[#7c7193]">{token.usage}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              {vbeeSystemPillars.map((item) => (
                <article key={item.title} className="vbee-surface p-5 transition hover:-translate-y-1 hover:border-[#ffcb05]/60">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#21104a] text-[#ffcb05]">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-xl font-black text-[#21104a]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#6a5a8f]">{item.desc}</p>
                </article>
              ))}
            </div>

            <div className="vbee-surface-dark overflow-hidden p-6 text-white md:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="vbee-chip-dark">
                    <CheckCircle2 className="h-4 w-4" /> Component registry
                  </span>
                  <h3 className="mt-4 text-2xl font-black">Bộ khung để áp dụng cho mọi trang sau đăng nhập</h3>
                </div>
                <div className="rounded-2xl bg-[#ffcb05] px-4 py-2 text-sm font-black text-[#21104a]">Vbee v1/v2</div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {vbeeComponentRegistry.map(([name, desc]) => (
                  <div key={name} className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
                    <div className="text-sm font-black text-[#ffcb05]">{name}</div>
                    <p className="mt-2 text-xs font-semibold leading-5 text-white/68">{desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl bg-white p-4 text-[#21104a]">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-[#21104a] text-[#ffcb05]">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black">Quy tắc triển khai</p>
                    <p className="text-xs font-bold text-[#756894]">Tạo UI bằng token trước, component sau, rồi mới ghép thành workflow.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CoreCapabilities({ onStart }: { onStart: () => void }) {
  return (
    <section id="about" className="bg-white px-4 py-16 md:px-6 md:py-24">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.2rem] border border-[#eee8ff] bg-white shadow-[0_24px_100px_rgba(33,16,74,.1)]">
        <div className="grid lg:grid-cols-[1fr_.42fr]">
          <div className="p-6 md:p-10 lg:p-12">
            <p className="text-sm font-black uppercase tracking-[.16em] text-[#9b94a8]">Năng lực cốt lõi</p>
            <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight text-[#21104a] md:text-5xl">
              Một sản phẩm speech-to-text có cấu trúc như nền tảng thật
            </h2>
            <p className="mt-4 max-w-3xl leading-8 text-[#756894]">
              Các tính năng không đứng riêng lẻ nữa: upload, record, realtime, transcript, translation, export và billing cùng dùng chung một logic workspace.
            </p>
            <div className="mt-8 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
              {coreCapabilities.map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#f3f7ff] text-[#2f8bdc]">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#342b43]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#8c849b]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="my-10 h-px bg-[#ece6ff]" />
            <p className="text-sm font-black uppercase tracking-[.16em] text-[#9b94a8]">Nền tảng</p>
            <div className="mt-8 grid gap-8 md:grid-cols-3">
              {platformFeatures.map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#f3f7ff] text-[#2f8bdc]">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#342b43]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#8c849b]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative bg-[linear-gradient(155deg,#21104a,#32166f)] p-8 text-white md:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(255,203,5,.22),transparent_32%)]" />
            <div className="relative flex h-full min-h-[520px] flex-col justify-between">
              <div>
                <span className="inline-flex rounded-full bg-white px-5 py-2 text-xs font-black text-[#5a3aff]">Agent-ready 2026</span>
                <h2 className="mt-7 text-3xl font-black leading-tight md:text-4xl lg:text-5xl">Sản phẩm được thiết kế để người và AI cùng phát triển.</h2>
                <p className="mt-5 text-lg font-semibold leading-8 text-white/60">Nhận diện Vbee giữ trải nghiệm đồng nhất, backend provider giúp mở rộng API dễ hơn.</p>
                <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-white/10 px-4 py-3 font-black text-[#ffcb05]">
                <Sparkles className="h-5 w-5" /> Vbee UI + Components
                </div>
              </div>
              <button onClick={onStart} className="mt-10 inline-flex items-center justify-center gap-2 rounded-xl bg-[#ffcb05] px-6 py-4 font-black text-[#21104a] shadow-[0_18px_45px_rgba(255,203,5,.24)] transition hover:bg-[#ffdc45]">
                Vào workspace <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function VbeeEcosystem({ onStart }: { onStart: () => void }) {
  return (
    <section id="ecosystem" className="bg-white px-4 py-16 md:px-6 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[.82fr_1.18fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#fff3a6] px-4 py-2 text-xs font-black uppercase tracking-wide text-[#725a00]">
              <Sparkles className="h-4 w-4" /> Hệ sinh thái Vbee-style
            </div>
            <h2 className="mt-5 text-3xl font-black leading-tight text-[#21104a] md:text-5xl">Bổ sung đầy đủ các mảng mà một nền tảng AI Voice cần có</h2>
            <p className="mt-4 text-sm leading-8 text-[#6a5a8f] md:text-base">
              Khối này thay cho cách trình bày cũ: sản phẩm được gom lại thành hệ sinh thái rõ ràng, có provider, transcript, subtitle, team và support để trình bày với đối tác dễ hơn.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link to="/pricing" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ffcb05] px-6 py-3 font-black text-[#21104a] shadow-[0_14px_38px_rgba(255,203,5,.28)] transition hover:-translate-y-0.5 hover:bg-[#ffd842]">
                Xem bảng giá <ArrowRight className="h-4 w-4" />
              </Link>
              <button onClick={onStart} className="inline-flex items-center justify-center gap-2 rounded-full border border-[#21104a]/10 bg-white px-6 py-3 font-black text-[#21104a] transition hover:bg-[#f8f5ff]">
                Vào Studio
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {vbeeEcosystem.map((item) => (
              <div key={item.title} className="group rounded-[1.5rem] border border-[#eee8ff] bg-[#fbfaff] p-5 shadow-[0_16px_55px_rgba(33,16,74,.06)] transition hover:-translate-y-1 hover:border-[#ffcb05]/60 hover:shadow-[0_24px_80px_rgba(33,16,74,.12)]">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#21104a] text-[#ffcb05] shadow-[0_12px_28px_rgba(33,16,74,.18)]">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-black text-[#21104a]">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-[#6a5a8f]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkspacePreview({ onStart }: { onStart: () => void }) {
  return (
    <section id="workspace" className="bg-[#f7f4ff] px-4 py-16 md:px-6 md:py-24">
      <div className="mx-auto max-w-7xl">
        <SectionTitle eyebrow="AI workspace" title="Một studio làm việc hoàn chỉnh cho audio và video" desc="Workspace gom mọi nguồn vào thành một luồng: upload, record, realtime -> transcript -> dịch/phụ đề/xuất file -> lưu history -> trừ quota theo gói." />
        <div className="mt-12 overflow-hidden rounded-[2.2rem] border border-[#e8e1ff] bg-white p-3 shadow-[0_28px_100px_rgba(33,16,74,.13)] md:p-5">
          <div className="rounded-[1.7rem] bg-[#f5f3fa] p-4">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.4rem] bg-white px-4 py-4">
              <div className="flex items-center gap-3">
                <Menu className="h-6 w-6 text-[#4c3f68]" />
                <img src={vbeeLogo} alt="Vbee" className="h-10 w-auto" />
                <span className="rounded-full bg-[#fff4b0] px-3 py-1 text-xs font-black text-[#21104a]">Studio</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="rounded-full bg-[#f1eff7] px-4 py-2 text-sm font-black text-[#21104a]">Tải lên</button>
                <button onClick={onStart} className="rounded-full bg-[#ffcb05] px-4 py-2 text-sm font-black text-[#21104a]">Tạo mới</button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[260px_1fr_280px]">
              <aside className="rounded-[1.4rem] bg-white p-4">
                <p className="font-black text-[#21104a]">Danh sách dự án</p>
                <div className="mt-4 space-y-3">
                  {["meeting-marketing.mp3", "phong-van-khach-hang.wav", "bai-giang-ai.mp4"].map((file, index) => (
                    <div key={file} className={`rounded-2xl p-3 ${index === 0 ? "bg-[#21104a] text-white" : "bg-[#f7f4ff] text-[#4d4264]"}`}>
                      <div className="flex items-center gap-2">
                        <FileAudio className="h-4 w-4 text-[#ffcb05]" />
                        <span className="text-sm font-black">{file}</span>
                      </div>
                      <p className={`mt-1 text-xs ${index === 0 ? "text-white/60" : "text-[#8b829d]"}`}>Đã xử lý · 12 phút trước</p>
                    </div>
                  ))}
                </div>
              </aside>

              <div className="rounded-[1.4rem] bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee8ff] pb-4">
                  <div>
                    <p className="text-sm font-bold text-[#8b829d]">Bản chép lời</p>
                    <h3 className="text-2xl font-black text-[#21104a]">Cuộc họp chiến dịch tháng 7</h3>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-full bg-[#f7f4ff] px-3 py-2 text-xs font-black text-[#21104a]">Dịch</button>
                    <button className="rounded-full bg-[#f7f4ff] px-3 py-2 text-xs font-black text-[#21104a]">Phụ đề</button>
                    <button className="rounded-full bg-[#ffcb05] px-3 py-2 text-xs font-black text-[#21104a]">DOCX</button>
                  </div>
                </div>
                <div className="mt-5 space-y-4 leading-8 text-[#5e5472]">
                  {[
                    ["00:00", "Hôm nay chúng ta thống nhất kế hoạch truyền thông, phân công nội dung và lịch xuất bản."],
                    ["00:21", "AI đã tự động tóm tắt ba ý chính, nhận diện người nói và đánh dấu các nhiệm vụ cần làm."],
                    ["00:47", "Sau khi chỉnh sửa, nhóm có thể xuất bản transcript, phụ đề hoặc tài liệu báo cáo."],
                  ].map(([time, text]) => (
                    <p key={time} className="rounded-2xl bg-[#faf9ff] p-4">
                      <span className="mr-3 rounded-full bg-[#fff4b0] px-3 py-1 text-xs font-black text-[#21104a]">{time}</span>
                      {text}
                    </p>
                  ))}
                </div>
              </div>

              <aside className="rounded-[1.4rem] bg-white p-4">
                <div className="rounded-2xl border border-[#eee8ff] px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#8b829d]"><Search className="h-4 w-4" /> Tìm kiếm theo từ khóa</div>
                </div>
                <div className="mt-4 rounded-2xl bg-[#21104a] p-4 text-white">
                  <Sparkles className="h-6 w-6 text-[#ffcb05]" />
                  <h4 className="mt-3 font-black">AI Summary</h4>
                  <p className="mt-2 text-sm leading-6 text-white/65">Tóm tắt nội dung, tạo bullet và đề xuất hành động tiếp theo.</p>
                </div>
                <div className="mt-4 grid gap-3">
                  {["Tạo biên bản họp", "Tạo phụ đề video", "Dịch sang English"].map((item) => (
                    <button key={item} className="rounded-2xl bg-[#f7f4ff] px-4 py-3 text-left text-sm font-black text-[#21104a]">{item}</button>
                  ))}
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductShowcase({ onStart }: { onStart: () => void }) {
  return (
    <section className="bg-white px-4 py-16 md:px-6 md:py-24">
      <div className="mx-auto max-w-7xl">
        <SectionTitle eyebrow="Sản phẩm" title="Đầy đủ tính năng để trình bày như một platform" desc="Các module được chia theo nhóm sản phẩm: speech-to-text, translation, subtitle, API/provider, billing/quota và transcript management." />
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {productShowcases.map((item, index) => (
            <article id={item.id} key={item.id} className="group overflow-hidden rounded-[2rem] border border-[#eee8ff] bg-white p-5 shadow-[0_18px_70px_rgba(33,16,74,.08)] transition hover:-translate-y-1 hover:shadow-[0_26px_100px_rgba(33,16,74,.14)] md:p-6">
              <ProductMockup index={index} />
              <div className="mt-6 flex gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#21104a] text-[#ffcb05]"><item.icon className="h-6 w-6" /></div>
                <div>
                  <span className="rounded-full bg-[#fff4b0] px-3 py-1 text-xs font-black uppercase tracking-wide text-[#7a5d00]">{item.eyebrow}</span>
                  <h3 className="mt-3 text-2xl font-black leading-tight text-[#21104a]">{item.title}</h3>
                  <p className="mt-3 leading-7 text-[#756894]">{item.desc}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.points.map((point) => (
                      <span key={point} className="inline-flex items-center gap-1 rounded-full bg-[#f7f4ff] px-3 py-1.5 text-xs font-black text-[#4a3c66]"><CheckCircle2 className="h-3.5 w-3.5 text-[#ffcb05]" />{point}</span>
                    ))}
                  </div>
                  <button onClick={onStart} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#ffcb05] px-5 py-3 text-sm font-black text-[#21104a] transition hover:bg-[#ffdc45]">
                    Dùng ngay <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductMockup({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className="relative h-64 overflow-hidden rounded-[1.6rem] bg-[#21104a] p-5">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#ffcb05]/20 blur-3xl" />
        <div className="rounded-2xl bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#eee8ff] pb-3">
            <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#ffcb05]"><FileText className="h-4 w-4" /></span><span className="text-sm font-black text-[#21104a]">Transcript</span></div>
            <span className="rounded-full bg-[#f7f4ff] px-3 py-1 text-xs font-black text-[#21104a]">AI</span>
          </div>
          <div className="mt-4 space-y-3">
            {["00:00 Xin chào, đây là bản ghi tự động.", "00:18 AI đang nhận diện từng câu nói.", "00:42 Bạn có thể sửa và xuất DOCX."].map((line) => <p key={line} className="rounded-xl bg-[#f7f4ff] px-3 py-2 text-xs font-semibold text-[#6a5a8f]">{line}</p>)}
          </div>
        </div>
      </div>
    );
  }
  if (index === 1) {
    return (
      <div className="relative h-64 overflow-hidden rounded-[1.6rem] bg-[#f7f4ff] p-5">
        <div className="grid grid-cols-2 gap-4">
          {["Tiếng Việt", "English", "日本語", "한국어", "Français", "Deutsch"].map((language) => (
            <div key={language} className="rounded-2xl bg-white p-4 shadow-sm">
              <Languages className="h-5 w-5 text-[#ffcb05]" />
              <p className="mt-3 font-black text-[#21104a]">{language}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (index === 2) {
    return (
      <div className="relative h-64 overflow-hidden rounded-[1.6rem] bg-[#21104a] p-5 text-white">
        <div className="aspect-video rounded-2xl bg-[linear-gradient(135deg,#4b2aa0,#130727)] p-4 shadow-xl">
          <div className="h-full rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="mt-20 rounded-xl bg-black/70 px-4 py-3 text-center text-sm font-bold">Đây là phụ đề được tạo tự động</div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <span className="rounded-full bg-[#ffcb05] px-4 py-2 text-xs font-black text-[#21104a]">SRT</span>
          <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-black">VTT</span>
          <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-black">Timeline</span>
        </div>
      </div>
    );
  }
  return (
    <div className="relative h-64 overflow-hidden rounded-[1.6rem] bg-[#f7f4ff] p-5">
      <div className="rounded-2xl bg-[#21104a] p-4 text-white">
        <p className="font-mono text-xs text-[#ffcb05]">POST /api/transcribe</p>
        <div className="mt-4 space-y-2 font-mono text-xs text-white/70">
          <p>{`{`}</p>
          <p>&nbsp;&nbsp;"file": "meeting.mp3",</p>
          <p>&nbsp;&nbsp;"language": "vi",</p>
          <p>&nbsp;&nbsp;"output": "transcript"</p>
          <p>{`}`}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {["Token", "Webhook", "Usage"].map((item) => <div key={item} className="rounded-2xl bg-white p-3 text-center text-sm font-black text-[#21104a] shadow-sm">{item}</div>)}
      </div>
    </div>
  );
}

function Workflow({ onStart }: { onStart: () => void }) {
  return (
    <section className="relative bg-[#21104a] px-4 py-16 text-white md:px-6 md:py-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,203,5,.2),transparent_28%),radial-gradient(circle_at_80%_55%,rgba(122,90,255,.22),transparent_32%)]" />
      <div className="relative mx-auto max-w-7xl">
        <SectionTitle dark eyebrow="Luồng khách hàng" title="Từ đăng nhập đến transcript hoàn chỉnh" desc="Tham khảo cách Sonix làm đơn giản hành trình: user vào là biết tạo transcript bằng gì, AI xử lý đến đâu, kết quả nằm ở đâu và khi nào cần nâng cấp gói." />
        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {workflowSteps.map((step, index) => (
            <div key={step.title} className="relative rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 backdrop-blur">
              <div className="absolute right-6 top-6 text-6xl font-black text-white/5">0{index + 1}</div>
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#ffcb05] text-[#21104a]"><step.icon className="h-7 w-7" /></div>
              <h3 className="mt-6 text-xl font-black">{step.title}</h3>
              <p className="mt-3 leading-7 text-white/65">{step.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <button onClick={onStart} className="inline-flex items-center gap-2 rounded-full bg-[#ffcb05] px-7 py-4 font-black text-[#21104a] transition hover:bg-[#ffdc45]">Bắt đầu chuyển đổi <ArrowRight className="h-5 w-5" /></button>
        </div>
      </div>
    </section>
  );
}

function Referral({ onStart }: { onStart: () => void }) {
  return (
    <section id="referral" className="bg-white text-[#21104a]">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
        <div className="grid gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#fff3a6] px-4 py-2 text-xs font-black uppercase tracking-wide text-[#725a00]">
              <Gift className="h-4 w-4" /> Giới thiệu Vbee
            </span>
            <h2 className="mt-5 text-4xl font-black leading-tight md:text-6xl">
              Cùng nhau nhận thưởng
            </h2>
            <p className="mt-5 max-w-xl text-base font-semibold leading-8 text-[#62557b] md:text-lg">
              Nhận ngay 5.000 điểm cho mỗi lần người dùng mới đăng ký bằng liên kết mời của bạn. Giới thiệu càng nhiều, thưởng càng lớn.
            </p>
            <button onClick={onStart} className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-[#ffcb05] px-7 py-4 font-black text-[#21104a] shadow-[0_18px_45px_rgba(255,203,5,.28)] transition hover:-translate-y-0.5 hover:bg-[#ffdc45]">
              Nhận thưởng ngay <ArrowRight className="h-5 w-5" />
            </button>
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-[520px]">
            <div className="absolute inset-8 rounded-full border-2 border-[#ffcb05]/45" />
            <div className="absolute inset-16 rounded-full border border-[#ffcb05]/35" />
            <div className="absolute left-1/2 top-1/2 grid h-72 w-72 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#ffcb05] shadow-[0_28px_90px_rgba(255,203,5,.3)] md:h-80 md:w-80">
              <div className="text-center">
                <div className="mx-auto grid h-24 w-24 place-items-center rounded-[2rem] bg-white text-[#21104a] shadow-[0_14px_45px_rgba(33,16,74,.18)]">
                  <Headphones className="h-12 w-12" />
                </div>
                <p className="mt-5 text-2xl font-black">Mời bạn bè</p>
                <p className="mt-1 text-sm font-bold opacity-70">Cùng nhận điểm</p>
              </div>
            </div>
            <div className="absolute left-6 top-16 grid h-20 w-20 place-items-center rounded-full bg-white shadow-[0_18px_50px_rgba(33,16,74,.16)]">
              <Users className="h-9 w-9 text-[#21104a]" />
            </div>
            <div className="absolute right-8 top-24 grid h-16 w-16 place-items-center rounded-2xl bg-white shadow-[0_18px_50px_rgba(33,16,74,.16)]">
              <Gift className="h-8 w-8 text-[#ffcb05]" />
            </div>
            <div className="absolute bottom-10 right-4 rounded-full border border-[#ffcb05] bg-white px-4 py-3 text-sm font-black shadow-xl">
              +5.000 điểm
            </div>
          </div>
        </div>

        <div className="mt-20 text-center">
          <h3 className="text-3xl font-black leading-tight md:text-5xl">
            Nhận thưởng chỉ với<br className="hidden sm:block" /> 3 bước đơn giản
          </h3>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {referralSteps.map((step, index) => (
            <article key={step.title} className="overflow-hidden rounded-[2rem] border border-[#eee8ff] bg-white p-5 shadow-[0_18px_70px_rgba(33,16,74,.09)]">
              <div className="relative h-56 overflow-hidden rounded-[1.5rem] bg-[#21104a] p-5 text-white">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,203,5,.22),transparent_30%),radial-gradient(circle_at_80%_75%,rgba(255,255,255,.12),transparent_30%)]" />
                <div className="relative">
                  <span className="inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white/80">
                    {step.tag}
                  </span>
                  {index === 0 && (
                    <>
                      <div className="mt-8 flex items-center gap-3 rounded-2xl border border-[#ffcb05] bg-white/10 px-4 py-4">
                        <Copy className="h-5 w-5 text-[#ffcb05]" />
                        <span className="truncate text-sm font-black">{step.visual}</span>
                      </div>
                      <div className="mt-5 flex justify-center gap-3">
                        {["f", "m", "Z", "G"].map((social) => (
                          <span key={social} className="grid h-10 w-10 place-items-center rounded-xl bg-white text-sm font-black text-[#21104a]">
                            {social}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                  {index === 1 && (
                    <div className="mt-8 rounded-2xl bg-white/10 p-5 text-center">
                      <div className="mx-auto h-4 max-w-56 rounded-full bg-white/40" />
                      <div className="mx-auto mt-5 h-3 max-w-44 rounded-full bg-white/55" />
                      <button className="mt-8 rounded-full bg-[#ffcb05] px-6 py-3 text-sm font-black text-[#21104a]">
                        {step.visual}
                      </button>
                    </div>
                  )}
                  {index === 2 && (
                    <div className="mt-8 grid gap-4">
                      <div className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
                        <span className="flex -space-x-2">
                          {[1, 2, 3].map((n) => (
                            <span key={n} className="grid h-9 w-9 place-items-center rounded-full border-2 border-[#21104a] bg-[#ffcb05] text-xs font-black text-[#21104a]">
                              {n}
                            </span>
                          ))}
                        </span>
                        <span className="rounded-full bg-white/20 px-4 py-2 text-sm font-black">{step.tag}</span>
                      </div>
                      <div className="ml-auto rounded-full bg-white/20 px-4 py-2 text-sm font-black">{step.visual}</div>
                    </div>
                  )}
                </div>
              </div>
              <h4 className="mt-6 text-2xl font-black leading-tight text-[#21104a]">
                {index + 1}. {step.title}
              </h4>
              <p className="mt-3 leading-7 text-[#62557b]">{step.desc}</p>
            </article>
          ))}
        </div>

        <div className="mt-12 text-center">
          <h3 className="text-3xl font-black leading-tight text-[#21104a] md:text-4xl">
            Bắt đầu mời bạn bè và nhận thưởng ngay hôm nay!
          </h3>
        </div>
      </div>

      <div className="bg-[#21104a] px-4 py-16 text-white md:px-6 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <h3 className="text-3xl font-black leading-tight md:text-5xl">
              Cộng thưởng khi lần đầu mua gói
            </h3>
            <p className="mt-5 text-base font-semibold leading-8 text-white/68">
              Ngay khi người được bạn giới thiệu mua gói cước đầu tiên, cả hai sẽ nhận thêm điểm miễn phí. Đặc biệt, càng giới thiệu nhiều, bạn càng có thể tích lũy tới hàng trăm nghìn điểm thưởng.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 backdrop-blur">
              <div className="flex gap-4">
                <Sparkles className="mt-1 h-7 w-7 shrink-0 text-[#ffcb05]" />
                <div>
                  <h4 className="text-2xl font-black">Dành cho người được giới thiệu</h4>
                  <p className="mt-3 leading-8 text-white/70">
                    Khi mua gói cước lần đầu, bạn sẽ được tặng ngay 40.000 điểm miễn phí để thỏa sức khám phá AI speech-to-text chất lượng cao.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 backdrop-blur">
              <div className="flex gap-4">
                <Gift className="mt-1 h-7 w-7 shrink-0 text-[#ffcb05]" />
                <div>
                  <h4 className="text-2xl font-black">Dành cho người giới thiệu</h4>
                  <p className="mt-3 leading-8 text-white/70">
                    Khi bạn bè mua gói đầu tiên, bạn cũng nhận điểm thưởng tương ứng. Tổng giá trị càng lớn, phần thưởng cộng thêm càng cao.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 overflow-hidden rounded-[2rem] border border-[#ffcb05] bg-[#2c1b61] p-6 shadow-[0_24px_90px_rgba(0,0,0,.22)]">
            <div className="grid gap-5 md:grid-cols-3">
              {rewardMilestones.map((item) => (
                <div key={item.title} className="rounded-[1.5rem] bg-white/[0.06] p-5 text-center">
                  <p className="text-sm font-bold text-white/55">{item.title}</p>
                  <div className="mx-auto mt-5 grid h-20 w-20 place-items-center rounded-full bg-white text-[#21104a] shadow-[0_0_35px_rgba(255,203,5,.35)]">
                    <Gift className="h-9 w-9 text-[#ffcb05]" />
                  </div>
                  <p className="mt-5 text-2xl font-black text-white">{item.reward}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto max-w-5xl">
          <h3 className="text-center text-3xl font-black leading-tight text-[#21104a] md:text-5xl">
            Khách hàng nói gì về chương trình "Giới thiệu bạn bè" của Vbee
          </h3>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {referralTestimonials.map((item) => (
              <article key={item.name} className="relative rounded-[2rem] border border-[#eee8ff] bg-[#fbfcff] p-7 shadow-[0_18px_70px_rgba(33,16,74,.08)]">
                <div className="absolute right-6 top-6 grid h-14 w-14 place-items-center rounded-full bg-[#ffcb05] text-[#21104a] shadow-[0_10px_30px_rgba(255,203,5,.35)]">
                  <Headphones className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-[#21104a] text-lg font-black text-[#ffcb05]">
                    {item.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-[#21104a]">{item.name}</h4>
                    <p className="text-sm font-bold text-[#8b829d]">{item.role}</p>
                  </div>
                </div>
                <div className="my-6 h-px bg-[#e5dff3]" />
                <p className="text-base font-semibold leading-8 text-[#62557b]">{item.quote}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 flex justify-center gap-3">
            <button className="grid h-11 w-11 place-items-center rounded-full border border-[#cfc7dd] text-xl font-black text-[#756894]">‹</button>
            <button className="grid h-11 w-11 place-items-center rounded-full border border-[#cfc7dd] text-xl font-black text-[#756894]">›</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Resources() {
  return (
    <section id="resources" className="bg-white px-4 py-16 md:px-6 md:py-24">
      <div className="mx-auto max-w-7xl">
        <SectionTitle eyebrow="Tài nguyên" title="Nội dung hỗ trợ người dùng mới" desc="Tài nguyên giúp khách hàng hiểu cách upload, ghi âm, realtime, mua gói và xử lý lỗi provider API." />
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: BookOpen, title: "Blog", desc: "Bài viết về AI, phiên âm và tối ưu nội dung." },
            { icon: Video, title: "Videos", desc: "Video hướng dẫn upload, record và xuất phụ đề." },
            { icon: Network, title: "Cộng đồng", desc: "Chia sẻ kinh nghiệm dùng AI trong học tập và công việc." },
            { icon: Headphones, title: "Trợ giúp", desc: "FAQ, liên hệ hỗ trợ và hướng dẫn triển khai." },
          ].map((item) => (
            <div key={item.title} className="rounded-[1.7rem] border border-[#eee8ff] bg-white p-6 shadow-[0_14px_50px_rgba(33,16,74,.06)]">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fff4b0] text-[#21104a]"><item.icon className="h-6 w-6" /></div>
              <h3 className="mt-5 text-xl font-black text-[#21104a]">{item.title}</h3>
              <p className="mt-2 leading-7 text-[#756894]">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="bg-[#f7f4ff] px-4 py-16 md:px-6 md:py-24">
      <div className="mx-auto max-w-4xl">
        <SectionTitle eyebrow="Câu hỏi thường gặp" title="Bạn cần biết gì trước khi dùng?" desc="Các câu hỏi quan trọng cho người mới dùng nền tảng chuyển giọng nói thành văn bản." />
        <div className="mt-10 space-y-4">
          {faqs.map(([question, answer]) => (
            <details key={question} className="group rounded-2xl bg-white p-5 shadow-[0_12px_45px_rgba(33,16,74,.07)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black text-[#21104a]">
                <span className="flex items-center gap-3"><Headphones className="h-5 w-5 text-[#ffcb05]" />{question}</span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f7f4ff] text-xl leading-none transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 leading-7 text-[#756894]">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContactCta({ onStart }: { onStart: () => void }) {
  return (
    <section id="contact" className="bg-white px-4 py-16 md:px-6">
      <div className="mx-auto grid max-w-7xl gap-8 overflow-hidden rounded-[2.2rem] bg-[#ffcb05] p-8 text-[#21104a] md:p-12 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/50 px-4 py-2 text-xs font-black uppercase tracking-wide"><Zap className="h-4 w-4" /> Sẵn sàng dùng thử</span>
          <h2 className="mt-5 text-3xl font-black leading-tight md:text-5xl">Bắt đầu với AI Speech Workspace</h2>
          <p className="mt-3 max-w-2xl font-semibold opacity-75">Đăng nhập để dùng upload, ghi âm, realtime, lịch sử transcript, quota và mua gói.</p>
        </div>
        <button onClick={onStart} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#21104a] px-8 py-4 font-black text-white transition hover:bg-[#30116b]">Vào studio <ArrowRight className="h-5 w-5" /></button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#21104a] px-4 py-12 text-white md:px-6">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-2 lg:grid-cols-6">
        {[
          ["Sản phẩm", ["Bộ sản phẩm", "AICall", "AIVoice", "SmartDialog Platform", "Nhân viên ảo AI", "CollectorAI", "ReminderAI", "SurveyorAI", "AnnouncerAI"]],
          ["Lĩnh vực", ["Ngân hàng", "Tài chính", "Bảo hiểm", "Viễn thông", "Bất động sản", "Giáo dục", "Bán lẻ", "Giải trí", "Sức khỏe"]],
          ["Ứng dụng", ["Kinh doanh", "Tiếp thị", "Trải nghiệm khách hàng", "Trải nghiệm tổng đài viên", "Hỗ trợ nhân sự"]],
          ["Tài nguyên", ["Blog", "Videos", "Câu chuyện thành công", "Tài liệu bán hàng"]],
          ["Công ty", ["Về chúng tôi", "Tuyển dụng", "Liên hệ"]],
        ].map(([title, links]) => (
          <div key={String(title)}>
            <h3 className="text-xl font-black text-[#ffcb05]">{title}</h3>
            <div className="mt-5 space-y-3 text-sm font-bold leading-6 text-white/82">
              {(links as string[]).map((link) => <p key={link}>{link}</p>)}
            </div>
          </div>
        ))}

        <div className="lg:col-span-1">
          <img src={vbeeLogo} alt="Vbee" className="h-14 w-auto rounded-xl bg-white/95 p-1" />
          <p className="mt-5 text-sm font-bold uppercase leading-6 text-white/82">
            Công ty cổ phần công nghệ trí tuệ nhân tạo Vbee Aitalk
          </p>
          <div className="mt-5 space-y-4 text-sm font-semibold leading-6 text-white/72">
            <p className="flex gap-3">
              <Globe2 className="mt-1 h-4 w-4 shrink-0 text-[#ffcb05]" />
              Số 35A ngõ 32 đường Bưởi, Phường Giảng Võ, Thành phố Hà Nội, Việt Nam
            </p>
            <p className="flex gap-3">
              <Mail className="mt-1 h-4 w-4 shrink-0 text-[#ffcb05]" />
              contact@vbee.ai
            </p>
            <p className="flex gap-3">
              <Phone className="mt-1 h-4 w-4 shrink-0 text-[#ffcb05]" />
              (+84) 249 999 3399
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-7xl border-t border-[#ffcb05]/70 pt-8">
        <div className="flex flex-wrap items-center gap-3">
          {["Zalo", "Facebook", "YouTube", "TikTok", "Instagram"].map((item) => (
            <span key={item} className="rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white/80">{item}</span>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {["Bank", "VNPay", "MoMo", "VISA", "Mastercard", "JCB"].map((item) => (
            <span key={item} className="rounded-xl bg-white px-4 py-2 text-xs font-black text-[#21104a]">{item}</span>
          ))}
        </div>
        <div className="mt-8 text-sm text-white/58">© 2026 Vbee.vn Conversational AI Ecosystem</div>
        <div className="mt-5 flex flex-wrap gap-6 text-sm font-semibold text-white/42">
          <span>Điều khoản dịch vụ</span>
          <span>Chính sách bảo mật</span>
          <span>Chính sách thanh toán</span>
        </div>
      </div>
    </footer>
  );
}

function SectionTitle({ eyebrow, title, desc, dark = false }: { eyebrow: string; title: string; desc: string; dark?: boolean }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide ${dark ? "bg-white/10 text-[#ffcb05]" : "bg-[#fff4b0] text-[#7a5d00]"}`}>
        <Sparkles className="h-4 w-4" /> {eyebrow}
      </span>
      <h2 className={`mt-4 text-3xl font-black leading-tight md:text-5xl ${dark ? "text-white" : "text-[#21104a]"}`}>{title}</h2>
      <p className={`mt-4 leading-8 md:text-lg ${dark ? "text-white/65" : "text-[#756894]"}`}>{desc}</p>
    </div>
  );
}
