import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  ArrowRight,
  AudioLines,
  Check,
  Clock,
  Copy,
  Download,
  FileAudio,
  FileVideo,
  Folder,
  FolderPlus,
  HardDrive,
  Heart,
  Home,
  Info,
  Languages,
  Link2,
  ListChecks,
  Mic,
  RotateCcw,
  SlidersHorizontal,
  Upload,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { useAuth } from "@/context/AuthContext";
import { AuthenticatedHeader } from "@/components/auth-app-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VbeePreferencesSidebar } from "@/components/vbee-preferences-layout";
import { formatQuotaTime, type QuotaStatus } from "@/lib/quota";
import {
  SPEECH_LANGUAGE_OPTIONS,
  TRANSLATION_LANGUAGE_OPTIONS,
  languageLabel,
  type TranslationResult,
} from "@/lib/language-options";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:3001";
const MAX_MB = 200;

const FORMAT_TAGS = ["MP3", "WAV", "M4A", "OGG", "FLAC", "AAC", "MP4", "WEBM"];
const UPLOAD_LANGUAGE_OPTIONS = SPEECH_LANGUAGE_OPTIONS.filter(
  (item) => item.value !== "auto" && item.value !== "multi",
);

interface Word {
  text: string;
  start: number;
  end: number;
}

interface HistoryItem {
  id: number;
  filename: string;
  file_size?: number;
  duration: number | null;
  text: string;
  source_language?: string | null;
  translated_text?: string | null;
  translation_target_language?: string | null;
  created_at: string;
}

type UploadStatus = "idle" | "uploading" | "done" | "error";
type UploadMode = "single" | "multi" | "link";
type AudioMode = "speech" | "song";
type ActionDialogState = {
  title: string;
  description: string;
  ctaLabel?: string;
  to?: string;
};

export const Route = createFileRoute("/upload")({
  component: UploadPage,
});

function formatDate(value?: string) {
  if (!value) return new Date().toLocaleDateString("vi-VN");
  return new Date(value).toLocaleDateString("vi-VN", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

function formatDuration(seconds?: number | null) {
  if (!seconds) return "Chưa xử lý";
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function formatBytes(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getFileIcon(filename: string) {
  if (filename.startsWith("recording.")) return Mic;
  if (/\.(mp4|webm)$/i.test(filename)) return FileAudio;
  return AudioLines;
}

function readMediaDuration(file: File) {
  return new Promise<number | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const media = document.createElement(
      file.type.startsWith("video/") ? "video" : "audio",
    );
    const cleanup = () => URL.revokeObjectURL(url);
    const timer = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, 3500);
    media.preload = "metadata";
    media.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const duration = Number.isFinite(media.duration) ? media.duration : null;
      cleanup();
      resolve(duration);
    };
    media.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      resolve(null);
    };
    media.src = url;
  });
}

function UploadPage() {
  const { user, isLoading, token } = useAuth();
  const navigate = useNavigate();

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [transcription, setTranscription] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [copied, setCopied] = useState(false);
  const [speakerLabels, setSpeakerLabels] = useState(false);
  const [audioMode, setAudioMode] = useState<AudioMode>("speech");
  const [transcriptionLanguage, setTranscriptionLanguage] = useState("vi");
  const [translateTo, setTranslateTo] = useState("none");
  const [translation, setTranslation] = useState<TranslationResult | null>(
    null,
  );
  const [translationError, setTranslationError] = useState("");
  const [words, setWords] = useState<Word[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [uploadMode, setUploadMode] = useState<UploadMode>("single");
  const [videoLink, setVideoLink] = useState("");
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("Dự án mới");
  const [activeFolder, setActiveFolder] = useState("Dự án mới");
  const [actionDialog, setActionDialog] = useState<ActionDialogState | null>(
    null,
  );
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [quotaRefreshKey, setQuotaRefreshKey] = useState(0);
  const [expectedDuration, setExpectedDuration] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const editRef = useRef<HTMLDivElement>(null);
  const spanRefs = useRef<HTMLSpanElement[]>([]);
  const activeIdxRef = useRef(-1);

  useEffect(() => {
    if (!isLoading && !user) {
      void navigate({
        to: "/login",
        search: { error: undefined, from: "/upload" },
      });
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (!user || !token) return;
    void fetch(`${API_URL}/api/transcribe/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? (r.json() as Promise<HistoryItem[]>) : []))
      .then((data) => setHistory(data.slice(0, 4)))
      .catch(() => setHistory([]));
  }, [user, token]);

  useEffect(() => {
    const div = editRef.current;
    if (!div) return;
    div.innerHTML = "";
    spanRefs.current = [];
    activeIdxRef.current = -1;
    if (words.length === 0) return;

    words.forEach((w, i) => {
      const span = document.createElement("span");
      span.className =
        "cursor-pointer rounded px-0.5 transition-colors duration-100 hover:bg-primary/15";
      span.textContent = w.text;
      span.onclick = () => {
        if (audioRef.current) {
          audioRef.current.currentTime = w.start / 1000;
          void audioRef.current.play();
        }
      };
      div.appendChild(span);
      if (i < words.length - 1) div.appendChild(document.createTextNode(" "));
      spanRefs.current.push(span);
    });
  }, [words]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalDuration = useMemo(() => {
    const historySeconds = history.reduce(
      (sum, item) => sum + (item.duration ?? 0),
      0,
    );
    return historySeconds + (duration ?? 0);
  }, [duration, history]);

  const pendingUploadSeconds =
    uploadFile && uploadStatus !== "done" && expectedDuration
      ? Math.ceil(expectedDuration)
      : 0;
  const projectedRemainingSeconds = quota
    ? Math.max(0, quota.remainingSeconds - pendingUploadSeconds)
    : null;

  function handleTimeUpdate() {
    if (!audioRef.current || spanRefs.current.length === 0) return;
    const ms = audioRef.current.currentTime * 1000;
    let newIdx = -1;
    for (let i = 0; i < words.length; i++) {
      if (words[i].start <= ms) newIdx = i;
      else break;
    }
    if (newIdx === activeIdxRef.current) return;

    const prev = spanRefs.current[activeIdxRef.current];
    if (prev) {
      prev.classList.remove(
        "bg-primary",
        "text-primary-foreground",
        "font-medium",
      );
      prev.classList.add("hover:bg-primary/15");
    }

    const cur = spanRefs.current[newIdx];
    if (cur) {
      cur.classList.add("bg-primary", "text-primary-foreground", "font-medium");
      cur.classList.remove("hover:bg-primary/15");
      cur.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    activeIdxRef.current = newIdx;
  }

  async function handleFileSelect(file: File) {
    if (!/\.(mp3|wav|m4a|ogg|flac|aac|mp4|webm)$/i.test(file.name)) {
      setUploadError(
        "Định dạng không hỗ trợ. Dùng MP3, WAV, M4A, OGG, FLAC, AAC",
      );
      return;
    }
    const maxMb = quota?.limits.maxUploadMb ?? MAX_MB;
    if (file.size > maxMb * 1024 * 1024) {
      setUploadError(`File quá lớn cho gói hiện tại (tối đa ${maxMb}MB)`);
      return;
    }
    if (quota?.isLimitReached) {
      setUploadError("Gói miễn phí đã hết thời lượng. Vui lòng nâng cấp gói cước.");
      return;
    }
    const duration = await readMediaDuration(file);
    if (duration && quota) {
      if (duration > quota.limits.maxFileSeconds) {
        setUploadError(
          `File vượt giới hạn ${formatQuotaTime(quota.limits.maxFileSeconds)} của gói ${quota.label}`,
        );
        return;
      }
      if (duration > quota.remainingSeconds) {
        setUploadError(
          `Quota còn lại không đủ. Còn ${formatQuotaTime(quota.remainingSeconds)}, file khoảng ${formatQuotaTime(duration)}.`,
        );
        return;
      }
    }
    setUploadFile(file);
    setExpectedDuration(duration);
    setUploadStatus("idle");
    setUploadError("");
    setTranscription("");
    setTranslation(null);
    setTranslationError("");
    setDuration(null);
    setWords([]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFileSelect(file);
  }

  async function handleUpload() {
    if (!uploadFile) return;
    setUploadStatus("uploading");
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("audio", uploadFile);
      formData.append("speakerLabels", String(speakerLabels));
      formData.append("source", "upload");
      formData.append("audioMode", audioMode);
      formData.append("language", transcriptionLanguage);
      formData.append("translateTo", translateTo);
      if (expectedDuration) {
        formData.append(
          "expectedDuration",
          String(Math.ceil(expectedDuration)),
        );
      }
      const res = await fetch(`${API_URL}/api/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = (await res.json()) as {
        id?: number;
        text?: string;
        duration?: number;
        error?: string;
        words?: Word[];
        filename?: string;
        createdAt?: string;
        quota?: QuotaStatus;
        translation?: TranslationResult | null;
        translationError?: string;
      };
      if (!res.ok) {
        if (data.quota) setQuota(data.quota);
        setUploadError(data.error ?? "Chuyển đổi thất bại");
        setUploadStatus("error");
        return;
      }
      setTranscription(data.text ?? "");
      setTranslation(data.translation ?? null);
      setTranslationError(data.translationError ?? "");
      setDuration(data.duration ?? null);
      setWords(data.words ?? []);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(uploadFile));
      setUploadStatus("done");
      setQuotaRefreshKey((key) => key + 1);
      if (data.quota) setQuota(data.quota);
      if (data.id) {
        setHistory((prev) =>
          [
            {
              id: data.id!,
              filename: data.filename ?? uploadFile.name,
              file_size: uploadFile.size,
              duration: data.duration ?? null,
              text: data.text ?? "",
              translated_text: data.translation?.text ?? null,
              translation_target_language:
                data.translation?.targetLanguage ?? null,
              source_language: data.translation?.sourceLanguage ?? null,
              created_at: data.createdAt ?? new Date().toISOString(),
            },
            ...prev.filter((item) => item.id !== data.id),
          ].slice(0, 4),
        );
      }
    } catch {
      setUploadError("Không thể kết nối đến server");
      setUploadStatus("error");
    }
  }

  async function handleCopy() {
    const text = editRef.current?.textContent ?? transcription;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownload() {
    const text = editRef.current?.textContent ?? transcription;
    const translated = translation?.text?.trim();
    const lines = translated
      ? [
          "Transcript gốc",
          "",
          text,
          "",
          `Bản dịch (${languageLabel(translation.targetLanguage)})`,
          "",
          translated,
        ]
      : text.split("\n");
    const baseName = uploadFile?.name.replace(/\.[^.]+$/, "") ?? "transcript";
    const doc = new Document({
      sections: [
        {
          children: lines.map(
            (line) =>
              new Paragraph({
                children: [new TextRun(line)],
              }),
          ),
        },
      ],
    });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadTxt() {
    const text = editRef.current?.textContent ?? transcription;
    const translated = translation?.text?.trim();
    const content = translated
      ? [
          "Transcript gốc",
          "",
          text,
          "",
          `Bản dịch (${languageLabel(translation.targetLanguage)})`,
          "",
          translated,
        ].join("\n")
      : text;
    const baseName = uploadFile?.name.replace(/\.[^.]+$/, "") ?? "transcript";
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setWords([]);
    setUploadFile(null);
    setUploadStatus("idle");
    setTranscription("");
    setTranslation(null);
    setTranslationError("");
    setAudioProcessingNote("");
    setUploadError("");
    setDuration(null);
    setExpectedDuration(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleCreateFolder() {
    const name = folderName.trim();
    if (!name) return;
    setActiveFolder(name);
    setFolderOpen(false);
    setFolderName("Dự án mới");
  }

  function handleVideoLink() {
    if (!videoLink.trim()) {
      setActionDialog({
        title: "Link video",
        description: "Hãy dán link video/audio công khai trước khi gửi.",
      });
      return;
    }
    setActionDialog({
      title: "Đã nhận link video",
      description:
        "Vbee hiện hỗ trợ xử lý file tải lên trực tiếp. Với video link công khai, hệ thống sẽ cần kết nối thêm bước lấy audio từ URL trước khi chuyển thành văn bản.",
      ctaLabel: "Chọn file thay thế",
      to: "choose-file",
    });
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AuthenticatedHeader />

      <div className="mx-auto max-w-7xl px-4 pt-3 md:px-6">
        <Link
          to="/dashboard"
          className="flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-white text-sm font-bold text-[#21104a] shadow-sm transition hover:border-primary/45 hover:bg-[#fbf8ef] hover:text-primary"
        >
          <Home className="h-4 w-4" />
          Home
        </Link>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,.m4a,.ogg,.flac,.aac,.mp4,.webm,audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFileSelect(f);
        }}
      />

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-6 md:px-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0">
          <div className="mb-5">
            <div className="mb-4 flex items-center gap-3">
              <Heart className="h-8 w-8 text-[#ffcb05]" />
              <h1 className="text-2xl font-light tracking-tight text-foreground md:text-3xl">
                Chào mừng, {user.firstName}
              </h1>
            </div>

            <div className="grid grid-cols-[1fr_1fr_44px] gap-2 sm:flex">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground shadow-glow transition hover:opacity-90"
              >
                <Upload className="h-4 w-4" />
                TẢI FILE
              </button>
              <button
                onClick={() => setFolderOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white px-4 py-2.5 text-sm font-black text-foreground transition hover:border-primary/50 hover:text-primary"
              >
                <FolderPlus className="h-4 w-4" />
                THƯ MỤC MỚI
              </button>
              <button
                onClick={() => {
                  if (transcription) {
                    void handleDownload();
                    return;
                  }
                  setActionDialog({
                    title: "Tải transcript",
                    description:
                      "Bạn cần upload và transcribe xong trước khi tải file .docx.",
                    ctaLabel: "Chọn file",
                    to: "choose-file",
                  });
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-muted-foreground transition hover:border-primary/50 hover:text-primary"
                title="Tải transcript"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>

            <UploadWorkflowSteps
              hasFile={Boolean(uploadFile)}
              status={uploadStatus}
            />

          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-white shadow-soft">
            <div className="border-b border-border bg-[#fbf8ef] px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
                    Dự án mới
                  </p>
                  <div className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <Folder className="h-4 w-4 text-primary" />
                    {activeFolder}
                  </div>
                </div>
                <div className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {history.length + (uploadFile ? 1 : 0)} items
                </div>
              </div>
            </div>

            {!uploadFile && (
              <div className="m-4 space-y-4">
                <section className="rounded-xl border border-border bg-[#fbf8ef] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-foreground">
                        1. Chọn nguồn cần chuyển đổi
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Chọn file, nhiều track của cùng một buổi ghi, hoặc link video công khai.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-primary">
                      <ListChecks className="h-3.5 w-3.5" />
                      Bước đầu tiên
                    </span>
                  </div>
                  <div className="mt-4">
                    <UploadModeSelector mode={uploadMode} setMode={setUploadMode} />
                  </div>
                </section>

                {uploadMode === "link" ? (
                  <VideoLinkPanel
                    videoLink={videoLink}
                    setVideoLink={setVideoLink}
                    onSubmit={handleVideoLink}
                    onChooseFile={() => fileInputRef.current?.click()}
                  />
                ) : (
                  <FileDropzone
                    isDragging={isDragging}
                    mode={uploadMode}
                    onChooseFile={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                  />
                )}

                <UploadRequirements
                  mode={uploadMode}
                  maxUploadMb={quota?.limits.maxUploadMb ?? MAX_MB}
                  maxFileSeconds={quota?.limits.maxFileSeconds ?? null}
                />
              </div>
            )}

            {uploadFile && (
              <VbeeFileCard
                filename={uploadFile.name}
                fileSize={uploadFile.size}
                status={uploadStatus}
                duration={duration ?? expectedDuration}
                date={new Date().toISOString()}
                error={uploadError}
                onClear={reset}
              >
                {uploadStatus !== "done" && (
                  <UploadTimeEstimatePanel
                    audioMode={audioMode}
                    expectedDuration={expectedDuration}
                    pendingUploadSeconds={pendingUploadSeconds}
                    projectedRemainingSeconds={projectedRemainingSeconds}
                    quota={quota}
                    uploadStatus={uploadStatus}
                  />
                )}

                {uploadStatus === "idle" && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-background/45 p-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <SlidersHorizontal className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-black">2. Thiết lập chuyển đổi</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Chọn ngôn ngữ và cách tạo transcript trước khi gửi file lên máy chủ.
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {[
                          {
                            value: "speech" as const,
                            title: "Lời nói rõ",
                            description: "Họp, podcast, phỏng vấn, bài giảng.",
                          },
                          {
                            value: "song" as const,
                            title: "Bài hát / nhạc nền",
                            description: "Ưu tiên tách vocal bằng Demucs trước khi tạo transcript.",
                          },
                        ].map((item) => (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => setAudioMode(item.value)}
                            className={`rounded-lg border px-3 py-3 text-left transition ${
                              audioMode === item.value
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-background/40 hover:border-primary/40"
                            }`}
                          >
                            <span className="block text-xs font-black">{item.title}</span>
                            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                              {item.description}
                            </span>
                          </button>
                        ))}
                      </div>
                      {audioMode === "song" && (
                        <p className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-5 text-primary">
                          Backend tách stem vocal bằng Demucs; nếu Demucs không khả dụng, hệ thống tự dùng ffmpeg để làm rõ giọng hát.
                        </p>
                      )}
                    </div>

                    <label className="flex items-center justify-between rounded-xl border border-border bg-background/45 px-4 py-3">
                      <div>
                        <p className="text-sm font-bold">Gắn nhãn người nói</p>
                        <p className="text-xs text-muted-foreground">
                          Phân biệt và đánh dấu từng người trong đoạn ghi âm
                        </p>
                      </div>
                      <span
                        className={`relative h-6 w-11 rounded-full transition-colors ${
                          speakerLabels ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            speakerLabels ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={speakerLabels}
                          onChange={(e) => setSpeakerLabels(e.target.checked)}
                        />
                      </span>
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="rounded-xl border border-border bg-background/45 px-4 py-3 text-left">
                        <span className="text-sm font-bold">
                          Ngôn ngữ âm thanh
                        </span>
                        <select
                          value={transcriptionLanguage}
                          onChange={(e) =>
                            setTranscriptionLanguage(e.target.value)
                          }
                          className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
                        >
                          {UPLOAD_LANGUAGE_OPTIONS.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                        <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                          Chọn đúng ngôn ngữ lời hát hoặc lời nói để tối ưu độ chính xác, đặc biệt khi dùng Sonix.
                        </span>
                      </label>
                      <label className="rounded-xl border border-border bg-background/45 px-4 py-3 text-left">
                        <span className="text-sm font-bold">
                          Dịch văn bản sang
                        </span>
                        <select
                          value={translateTo}
                          onChange={(e) => setTranslateTo(e.target.value)}
                          className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
                        >
                          {TRANSLATION_LANGUAGE_OPTIONS.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-5 text-muted-foreground">
                      Bản dịch được thực hiện sau khi transcript gốc đã tạo xong. Chọn “Tự nhận diện nhiều ngôn ngữ” khi một file có từ hai ngôn ngữ trở lên.
                    </p>
                    <button
                      onClick={() => void handleUpload()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-glow transition hover:opacity-90"
                    >
                      <Zap className="h-4 w-4" />
                      Bắt đầu chuyển đổi
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {uploadStatus === "uploading" && <ProcessingPanel translateTo={translateTo} />}

                {uploadStatus === "error" && (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
                      {uploadError}
                    </div>
                    <button
                      onClick={reset}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-bold transition hover:bg-card"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Thử lại
                    </button>
                  </div>
                )}

                {uploadStatus === "done" && (
                  <div className="space-y-4">
                    {audioUrl && (
                      <div className="rounded-xl border border-border bg-background/45 p-4">
                        <p className="mb-3 text-xs font-semibold text-muted-foreground">
                          Nghe lại - từ đang phát sẽ được highlight, nhấn vào từ
                          để tua
                        </p>
                        <audio
                          ref={audioRef}
                          src={audioUrl}
                          controls
                          onTimeUpdate={handleTimeUpdate}
                          className="w-full"
                        />
                      </div>
                    )}

                    {words.length > 0 ? (
                      <div className="rounded-xl border border-border bg-background/45 px-5 py-4">
                        <p className="mb-2 text-xs font-semibold text-muted-foreground">
                          Văn bản - có thể chỉnh sửa trực tiếp
                        </p>
                        <div
                          ref={editRef}
                          contentEditable
                          suppressContentEditableWarning
                          onInput={() => {
                            if (editRef.current) {
                              setTranscription(
                                editRef.current.textContent ?? "",
                              );
                            }
                          }}
                          className="max-h-64 min-h-24 overflow-y-auto whitespace-pre-wrap text-sm leading-[2.2] text-foreground outline-none"
                        />
                      </div>
                    ) : (
                      <textarea
                        value={transcription}
                        rows={8}
                        onChange={(e) => setTranscription(e.target.value)}
                        className="w-full resize-y rounded-xl border border-border bg-background/45 px-5 py-4 text-sm leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    )}

                    {translation?.text && (
                      <div className="rounded-xl border border-primary/30 bg-primary/10 px-5 py-4">
                        <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-primary">
                          Bản dịch {languageLabel(translation.targetLanguage)}
                        </p>
                        <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">
                          {translation.text}
                        </p>
                      </div>
                    )}

                    {translationError && (
                      <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
                        Transcript gốc đã tạo xong, nhưng chưa dịch được:{" "}
                        {translationError}
                      </div>
                    )}

                    <div className="grid gap-2 sm:grid-cols-3">
                      <button
                        onClick={() => void handleCopy()}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-bold transition hover:border-primary/50 hover:text-primary"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        {copied ? "Đã sao chép" : "Sao chép"}
                      </button>
                      <button
                        onClick={handleDownloadTxt}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-black text-primary transition hover:bg-primary/20"
                      >
                        <Download className="h-4 w-4" />
                        Tải .txt
                      </button>
                      <button
                        onClick={() => void handleDownload()}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground shadow-glow transition hover:opacity-90"
                      >
                        <Download className="h-4 w-4" />
                        Tải xuống .docx
                      </button>
                    </div>
                  </div>
                )}
              </VbeeFileCard>
            )}

            {history.map((item) => (
              <VbeeFileCard
                key={item.id}
                filename={item.filename}
                fileSize={item.file_size}
                status="done"
                duration={item.duration}
                date={item.created_at}
                compact
              />
            ))}

            <div className="border-t border-border bg-[#fbf8ef] px-5 py-3 text-center text-sm font-black text-primary">
              {history.length + (uploadFile ? 1 : 0)} items,{" "}
              {formatDuration(totalDuration)}
            </div>
          </div>
        </section>

        <VbeePreferencesSidebar
          firstName={user.firstName}
          refreshKey={quotaRefreshKey}
          onQuotaChange={setQuota}
        />
      </main>

      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent className="border-border bg-card text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tạo folder mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">
              Folder sẽ được chọn cho workspace upload hiện tại.
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
                    if (to === "choose-file") {
                      fileInputRef.current?.click();
                    } else if (to) {
                      void navigate({ to });
                    }
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

      <VbeeStyleFooter />
    </div>
  );
}

function FileDropzone({
  isDragging,
  mode,
  onChooseFile,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  isDragging: boolean;
  mode: Exclude<UploadMode, "link">;
  onChooseFile: () => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
}) {
  const multiTrack = mode === "multi";

  return (
    <div
      onClick={onChooseFile}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition ${
        isDragging
          ? "border-primary bg-primary/15"
          : "border-border bg-white hover:border-primary/50 hover:bg-primary/5"
      }`}
    >
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {multiTrack ? <AudioLines className="h-6 w-6" /> : <UploadCloud className="h-6 w-6" />}
      </span>
      <p className="mt-3 text-base font-black text-foreground">
        {multiTrack ? "Chọn track âm thanh đầu tiên" : "Kéo thả file vào đây"}
      </p>
      <p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
        {multiTrack
          ? "Mỗi track cần thuộc cùng một phiên ghi và cùng mốc thời gian. Backend hiện xử lý từng file; hãy dùng bản mixdown hoặc tải các track lần lượt."
          : "Hoặc nhấn để chọn một file audio/video từ máy tính."}
      </p>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onChooseFile();
        }}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-black text-primary-foreground shadow-glow transition hover:opacity-90"
      >
        <Upload className="h-3.5 w-3.5" />
        Chọn file
      </button>
      <div className="mt-4 flex flex-wrap justify-center gap-1.5">
        {FORMAT_TAGS.map((fmt) => (
          <span
            key={fmt}
            className="rounded-full border border-border bg-[#fbf8ef] px-2.5 py-1 text-[11px] font-bold text-muted-foreground"
          >
            {fmt}
          </span>
        ))}
      </div>
    </div>
  );
}

function VideoLinkPanel({
  videoLink,
  setVideoLink,
  onSubmit,
  onChooseFile,
}: {
  videoLink: string;
  setVideoLink: (value: string) => void;
  onSubmit: () => void;
  onChooseFile: () => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Link2 className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-black">Link video công khai</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Dùng URL mà máy chủ có thể truy cập không cần đăng nhập. Video riêng tư, link hết hạn hoặc cần mật khẩu sẽ không thể xử lý.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={videoLink}
          onChange={(event) => setVideoLink(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-border bg-[#fbf8ef] px-3 py-2.5 text-sm outline-none transition focus:border-primary"
          placeholder="https://video.example.com/..."
        />
        <button
          type="button"
          onClick={onSubmit}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground shadow-glow transition hover:opacity-90"
        >
          <FileVideo className="h-4 w-4" />
          Dùng link
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
        <p className="text-xs leading-5 text-muted-foreground">
          Kết nối lấy audio từ link đang được hoàn thiện cho backend Vbee.
        </p>
        <button
          type="button"
          onClick={onChooseFile}
          className="text-xs font-black text-primary underline underline-offset-4"
        >
          Chọn file từ máy
        </button>
      </div>
    </section>
  );
}

function UploadRequirements({
  mode,
  maxUploadMb,
  maxFileSeconds,
}: {
  mode: UploadMode;
  maxUploadMb: number;
  maxFileSeconds: number | null;
}) {
  const multiTrack = mode === "multi";
  const linkMode = mode === "link";

  return (
    <section className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-primary" />
        <p className="text-sm font-black">Điều kiện trước khi tải</p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="text-xs font-black text-foreground">Định dạng</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Audio và video có trong danh sách hiển thị phía trên.</p>
        </div>
        <div>
          <p className="text-xs font-black text-foreground">Giới hạn gói</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Tối đa {maxUploadMb} MB{maxFileSeconds ? `, ${formatQuotaTime(maxFileSeconds)}/file` : " mỗi file"}.
          </p>
        </div>
        <div>
          <p className="text-xs font-black text-foreground">Đa ngôn ngữ</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Chọn “Tự nhận diện nhiều ngôn ngữ” tại bước thiết lập.</p>
        </div>
        <div>
          <p className="text-xs font-black text-foreground">{linkMode ? "Link" : multiTrack ? "Nhiều track" : "Bản dịch"}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {linkMode
              ? "Chỉ dùng link công khai, không cần đăng nhập."
              : multiTrack
                ? "Các track cần cùng phiên ghi và được tải lần lượt ở phiên bản hiện tại."
                : "Bản dịch được tạo sau transcript gốc, không thay thế bản gốc."}
          </p>
        </div>
      </div>
    </section>
  );
}

function ProcessingPanel({ translateTo }: { translateTo: string }) {
  const phases = [
    ["Đang gửi file", "Tải file an toàn lên máy chủ Vbee."],
    ["Đang phân tích audio gốc", "Nhận diện lời nói, lời hát, thời lượng và người nói từ bản mix ban đầu."],
    [
      "Đang tạo transcript",
      translateTo === "none"
        ? "Bản transcript sẽ sẵn sàng để nghe lại và biên tập."
        : "Sau transcript gốc, hệ thống sẽ tạo thêm bản dịch đã chọn.",
    ],
  ];

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/10 p-4">
      <div className="flex items-center gap-3">
        <span className="block h-7 w-7 shrink-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <div>
          <p className="text-sm font-black text-primary">Vbee đang chuyển đổi file</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Không đóng trang này cho đến khi trạng thái hoàn tất.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {phases.map(([title, description], index) => (
          <div key={title} className="rounded-lg border border-primary/15 bg-white/80 px-3 py-2.5">
            <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${index === 0 ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
              {index === 0 ? <span className="h-2 w-2 rounded-full bg-current animate-pulse" /> : index + 1}
            </span>
            <p className="mt-2 text-xs font-black text-foreground">{title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function UploadTimeEstimatePanel({
  audioMode,
  expectedDuration,
  pendingUploadSeconds,
  projectedRemainingSeconds,
  quota,
  uploadStatus,
}: {
  audioMode: AudioMode;
  expectedDuration: number | null;
  pendingUploadSeconds: number;
  projectedRemainingSeconds: number | null;
  quota: QuotaStatus | null;
  uploadStatus: UploadStatus;
}) {
  const durationLabel =
    expectedDuration !== null
      ? formatQuotaTime(Math.ceil(expectedDuration))
      : "Chưa đọc được";
  const remainingLabel = quota
    ? formatQuotaTime(quota.remainingSeconds)
    : "Đang tải";
  const projectedLabel =
    projectedRemainingSeconds !== null
      ? formatQuotaTime(projectedRemainingSeconds)
      : "Chưa tính được";
  const quotaPercent =
    quota && pendingUploadSeconds > 0
      ? Math.min(
          100,
          Math.round(
            (pendingUploadSeconds / Math.max(1, quota.remainingSeconds)) * 100,
          ),
        )
      : 0;
  const processingMinutes =
    expectedDuration === null
      ? null
      : Math.max(
          1,
          Math.ceil(expectedDuration / 75),
        );

  return (
    <div className="mb-4 rounded-lg border border-border bg-[#fbf8ef] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-black text-primary">
          <Clock className="h-4 w-4" />
          Tính thời gian upload
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-primary">
          {uploadStatus === "uploading" ? "Đang xử lý" : "Ước tính trước"}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <div className="rounded-md bg-white px-3 py-2.5">
          <p className="text-xs font-bold text-muted-foreground">
            Thời lượng file
          </p>
          <p className="mt-1 text-lg font-black text-foreground">
            {durationLabel}
          </p>
        </div>
        <div className="rounded-md bg-white px-3 py-2.5">
          <p className="text-xs font-bold text-muted-foreground">
            Xử lý dự kiến
          </p>
          <p className="mt-1 text-lg font-black text-foreground">
            {processingMinutes === null ? "Đang đọc" : `~${processingMinutes} phút`}
          </p>
        </div>
        <div className="rounded-md bg-white px-3 py-2.5">
          <p className="text-xs font-bold text-muted-foreground">
            Gói còn lại
          </p>
          <p className="mt-1 text-lg font-black text-foreground">
            {remainingLabel}
          </p>
        </div>
        <div className="rounded-md bg-white px-3 py-2.5">
          <p className="text-xs font-bold text-muted-foreground">
            Sau khi xử lý
          </p>
          <p className="mt-1 text-lg font-black text-primary">
            {projectedLabel}
          </p>
        </div>
      </div>

      {pendingUploadSeconds > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-muted-foreground">
            <span>Quota dự kiến dùng</span>
            <span>{formatQuotaTime(pendingUploadSeconds)}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-card">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${quotaPercent}%` }}
            />
          </div>
        </div>
      )}

      <p className="mt-3 text-xs font-semibold leading-5 text-muted-foreground">
        {audioMode === "song"
          ? "File nhạc có thể lâu hơn vì server cần tách vocal trước khi chuyển thành văn bản."
          : "Đây là ước tính theo thời lượng file; thời gian thực tế phụ thuộc kích thước tệp và tải máy chủ."}
      </p>
    </div>
  );
}

function VbeeFileCard({
  filename,
  fileSize,
  status,
  duration,
  date,
  error,
  compact = false,
  children,
  onClear,
}: {
  filename: string;
  fileSize?: number;
  status: UploadStatus;
  duration?: number | null;
  date: string;
  error?: string;
  compact?: boolean;
  children?: ReactNode;
  onClear?: () => void;
}) {
  const Icon = getFileIcon(filename);
  const statusLabel =
    status === "done"
      ? "Đã chuyển đổi"
      : status === "uploading"
        ? "Đang xử lý"
        : status === "error"
          ? "Lỗi"
          : "Sẵn sàng";

  return (
    <div className="border-t border-border px-4 py-4">
      <div className="grid gap-y-3 text-sm sm:grid-cols-[120px_minmax(0,1fr)]">
        <p className="font-black text-muted-foreground">Tên file</p>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 font-semibold text-primary">
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{filename}</span>
          </span>
          {onClear && (
            <button
              onClick={onClear}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <p className="font-black text-muted-foreground">Trạng thái</p>
        <div>
          <span
            className={`inline-flex min-w-36 items-center justify-center gap-2 rounded-md px-4 py-2 text-xs font-black ${
              status === "error"
                ? "bg-destructive/15 text-destructive"
                : status === "idle"
                  ? "bg-primary/10 text-primary"
                  : "bg-emerald-500 text-white"
            }`}
          >
            {status === "uploading" ? (
              <span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              status !== "error" && <Check className="h-3.5 w-3.5" />
            )}
            {statusLabel}
          </span>
          {error && (
            <p className="mt-2 text-xs font-semibold text-destructive">
              {error}
            </p>
          )}
        </div>

        <p className="font-black text-muted-foreground">Thời lượng</p>
        <div className="flex flex-wrap items-center gap-3 font-semibold">
          <span>{formatDuration(duration)}</span>
          {fileSize ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <HardDrive className="h-3.5 w-3.5" />
              {formatBytes(fileSize)}
            </span>
          ) : null}
        </div>

        <p className="font-black text-muted-foreground">Ngày tạo</p>
        <p className="font-semibold">{formatDate(date)}</p>
      </div>

      {!compact && children && <div className="mt-4">{children}</div>}
    </div>
  );
}

function UploadWorkflowSteps({
  hasFile,
  status,
}: {
  hasFile: boolean;
  status: UploadStatus;
}) {
  const steps = [
    ["1", "Nguồn", "Chọn file, nhiều track hoặc link video"],
    ["2", "Cài đặt", "Ngôn ngữ, người nói và thư mục"],
    ["3", "Chuyển đổi", "AI xử lý và tạo transcript"],
    ["4", "Biên tập", "Nghe lại, sửa, copy và xuất file"],
  ];
  const activeIndex =
    status === "done" ? 3 : status === "uploading" ? 2 : hasFile ? 1 : 0;

  return (
    <div className="mt-4 grid gap-2 md:grid-cols-4">
      {steps.map(([number, title, desc], index) => {
        const active = index <= activeIndex;
        return (
          <div
            key={title}
            className={`rounded-lg border px-3 py-2.5 transition ${
              active
                ? "border-primary/30 bg-primary/5"
                : "border-border bg-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {index < activeIndex ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  number
                )}
              </span>
              <p className="text-sm font-black">{title}</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {desc}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function UploadModeSelector({
  mode,
  setMode,
}: {
  mode: UploadMode;
  setMode: (mode: UploadMode) => void;
}) {
  const modes: Array<{
    value: UploadMode;
    title: string;
    desc: string;
    icon: ComponentType<{ className?: string }>;
  }> = [
    {
      value: "single",
      title: "Một track",
      desc: "Một file audio/video chính",
      icon: FileAudio,
    },
    {
      value: "multi",
      title: "Nhiều track",
      desc: "Chuẩn bị cho nhiều người nói",
      icon: Mic,
    },
    {
      value: "link",
      title: "Link video",
      desc: "Dán link hoặc chọn file thay thế",
      icon: Languages,
    },
  ];

  return (
    <div className="grid gap-2 md:grid-cols-3">
      {modes.map((item) => {
        const Icon = item.icon;
        const active = mode === item.value;
        return (
          <button
            key={item.value}
            onClick={() => setMode(item.value)}
            className={`rounded-lg border p-3 text-left transition ${
              active
                ? "border-primary/40 bg-primary/5 text-foreground"
                : "border-border bg-white text-muted-foreground hover:border-primary/40"
            }`}
          >
            <Icon className="mb-3 h-5 w-5 text-primary" />
            <p className="font-black">{item.title}</p>
            <p className="mt-1 text-xs leading-5">{item.desc}</p>
          </button>
        );
      })}
    </div>
  );
}

function VbeeStyleFooter() {
  return (
    <footer className="mt-8 border-t border-border bg-white px-4 py-6 text-center text-sm text-muted-foreground">
      <p>© 2026 Vbee Voice. All rights reserved.</p>
      <div className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-2 font-semibold text-primary">
        <Link to="/">Vbee</Link>
        <Link to="/pricing">Bảng giá</Link>
        <Link to="/upload">Tải file</Link>
        <Link to="/api">API</Link>
      </div>
      <p className="mt-5 inline-flex items-center justify-center gap-2">
        Được phát triển cho trải nghiệm chuyển giọng nói thành văn bản rõ ràng.
      </p>
    </footer>
  );
}
