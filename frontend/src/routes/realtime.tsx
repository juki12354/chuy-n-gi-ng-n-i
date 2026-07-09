import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  History,
  Languages,
  Mic,
  Pause,
  Radio,
  RotateCcw,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AuthenticatedHeader } from "@/components/auth-app-header";
import { QuotaStatusPanel } from "@/components/quota-status-panel";
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

type SpeechRecognitionConstructor = new () => SpeechRecognition;

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult:
    | ((event: {
        resultIndex: number;
        results: SpeechRecognitionResultList;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export const Route = createFileRoute("/realtime")({
  component: RealtimePage,
});

function getSpeechLang(language: string) {
  const clean = String(language || "").toLowerCase();
  if (clean === "auto" || clean === "vi") return "vi-VN";
  if (clean === "en") return "en-US";
  if (clean === "fr") return "fr-FR";
  if (clean === "de") return "de-DE";
  if (clean === "es") return "es-ES";
  if (clean === "ja") return "ja-JP";
  if (clean === "ko") return "ko-KR";
  if (clean === "zh") return "zh-CN";
  return clean.includes("-") ? clean : "vi-VN";
}

function formatClock(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const secs = (total % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function RealtimePage() {
  const { user, isLoading, token } = useAuth();
  const navigate = useNavigate();

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [language, setLanguage] = useState("vi");
  const [translateTo, setTranslateTo] = useState("none");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [translation, setTranslation] = useState<TranslationResult | null>(
    null,
  );
  const [translationError, setTranslationError] = useState("");
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [quotaRefreshKey, setQuotaRefreshKey] = useState(0);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldRestartRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      void navigate({
        to: "/login",
        search: { error: undefined, from: "/realtime" },
      });
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      recognitionRef.current?.abort();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsed((value) => {
        const next = value + 1;
        const maxSeconds = quota?.remainingSeconds ?? null;
        if (maxSeconds && next >= maxSeconds) {
          window.setTimeout(() => stopListening(), 0);
        }
        return next;
      });
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function getSpeechRecognition() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function startListening() {
    setError("");
    setSavedId(null);
    setTranslation(null);
    setTranslationError("");

    if (quota?.isLimitReached) {
      setError("Bạn đã hết quota. Hãy nâng cấp gói để dùng realtime tiếp.");
      return;
    }

    const SpeechRecognitionApi = getSpeechRecognition();
    if (!SpeechRecognitionApi) {
      setError(
        "Trình duyệt này chưa hỗ trợ nói realtime. Hãy dùng Chrome hoặc Edge mới nhất.",
      );
      return;
    }

    shouldRestartRef.current = true;
    const recognition = new SpeechRecognitionApi();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = getSpeechLang(language);

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += text;
        else interimText += text;
      }
      if (finalText.trim()) {
        setTranscript((current) =>
          `${current}${current.trim() ? " " : ""}${finalText.trim()}`.trim(),
        );
      }
      setInterim(interimText.trim());
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech") return;
      setError(`Realtime lỗi: ${event.error}`);
    };

    recognition.onend = () => {
      if (shouldRestartRef.current) {
        try {
          recognition.start();
        } catch {
          shouldRestartRef.current = false;
          setListening(false);
          stopTimer();
        }
      }
    };

    try {
      recognition.start();
      setListening(true);
      startTimer();
    } catch {
      setError("Không thể bắt đầu realtime. Hãy thử lại sau vài giây.");
    }
  }

  function stopListening() {
    shouldRestartRef.current = false;
    recognitionRef.current?.stop();
    setListening(false);
    setInterim("");
    stopTimer();
  }

  function reset() {
    stopListening();
    setTranscript("");
    setInterim("");
    setElapsed(0);
    setError("");
    setCopied(false);
    setSavedId(null);
    setTranslation(null);
    setTranslationError("");
  }

  async function copyTranscript() {
    const text = `${transcript} ${interim}`.trim();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function downloadTxt() {
    const content = translation?.text
      ? [
          "Transcript gốc",
          "",
          transcript,
          "",
          `Bản dịch (${languageLabel(translation.targetLanguage)})`,
          "",
          translation.text,
        ].join("\n")
      : transcript;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "realtime-transcript.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveTranscript() {
    const text = transcript.trim();
    if (!text || !token) {
      setError("Chưa có transcript để lưu.");
      return;
    }
    setSaving(true);
    setError("");
    setTranslation(null);
    setTranslationError("");
    try {
      const res = await fetch(`${API_URL}/api/transcribe/text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text,
          durationSeconds: Math.max(1, elapsed),
          source: "realtime",
          language,
          translateTo,
        }),
      });
      const data = (await res.json()) as {
        id?: number;
        error?: string;
        quota?: QuotaStatus;
        translation?: TranslationResult | null;
        translationError?: string;
      };
      if (!res.ok) {
        if (data.quota) setQuota(data.quota);
        setError(data.error ?? "Không lưu được realtime transcript.");
        return;
      }
      setSavedId(data.id ?? null);
      setTranslation(data.translation ?? null);
      setTranslationError(data.translationError ?? "");
      if (data.quota) setQuota(data.quota);
      setQuotaRefreshKey((value) => value + 1);
    } catch {
      setError("Không kết nối được backend để lưu transcript realtime.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!user) return null;

  const liveText = `${transcript} ${interim}`.trim();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AuthenticatedHeader />

      <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-black uppercase tracking-wide text-primary">
              <Radio className="h-3.5 w-3.5" />
              V2 realtime
            </div>
            <h1 className="text-4xl font-black tracking-tight md:text-5xl">
              Nói realtime
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Nói vào microphone, chữ sẽ hiện gần realtime. Khi hoàn tất, bấm
              lưu để đưa transcript vào lịch sử và trừ quota theo thời gian nói.
            </p>
          </div>
          <Link
            to="/history"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card/70 px-5 py-3 text-sm font-black transition hover:border-primary/50 hover:text-primary"
          >
            <History className="h-4 w-4" />
            Mở lịch sử
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-2xl border border-border bg-card/80 p-5 shadow-soft">
            <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                  Phiên realtime
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-full ${
                      listening
                        ? "bg-primary text-primary-foreground shadow-glow"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    <Mic className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-2xl font-black">{formatClock(elapsed)}</p>
                    <p className="text-sm font-semibold text-muted-foreground">
                      {listening ? "Đang nghe..." : "Sẵn sàng nghe"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {listening ? (
                  <button
                    onClick={stopListening}
                    className="inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-5 py-3 text-sm font-black text-destructive transition hover:bg-destructive/20"
                  >
                    <Pause className="h-4 w-4" />
                    Dừng nghe
                  </button>
                ) : (
                  <button
                    onClick={startListening}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-glow transition hover:opacity-90"
                  >
                    <Mic className="h-4 w-4" />
                    Bắt đầu nói
                  </button>
                )}
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-black transition hover:bg-card"
                >
                  <RotateCcw className="h-4 w-4" />
                  Làm lại
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm font-semibold text-destructive">
                <X className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="mt-5 min-h-[330px] rounded-2xl border border-border bg-background/45 p-5">
              {liveText ? (
                <p className="whitespace-pre-wrap text-lg leading-9">
                  {transcript}
                  {interim && (
                    <span className="text-muted-foreground"> {interim}</span>
                  )}
                </p>
              ) : (
                <div className="flex min-h-[290px] flex-col items-center justify-center text-center">
                  <Sparkles className="h-12 w-12 text-primary/60" />
                  <h2 className="mt-4 text-xl font-black">
                    Bấm “Bắt đầu nói” để tạo transcript realtime
                  </h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    Trình duyệt sẽ xin quyền microphone. Nếu không thấy chữ,
                    hãy kiểm tra quyền microphone hoặc đổi sang Chrome/Edge.
                  </p>
                </div>
              )}
            </div>

            {translation?.text && (
              <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/10 p-5">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-primary">
                  Bản dịch {languageLabel(translation.targetLanguage)}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-7">
                  {translation.text}
                </p>
              </div>
            )}

            {translationError && (
              <div className="mt-5 rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
                Transcript đã lưu, nhưng chưa dịch được: {translationError}
              </div>
            )}

            {savedId && (
              <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
                <span className="font-bold">Đã lưu vào lịch sử.</span>
                <Link
                  to="/history"
                  className="rounded-full bg-primary px-4 py-2 text-xs font-black text-primary-foreground"
                >
                  Xem ngay
                </Link>
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <button
                onClick={() => void copyTranscript()}
                disabled={!liveText}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-black transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Đã copy" : "Copy"}
              </button>
              <button
                onClick={downloadTxt}
                disabled={!transcript.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-5 py-3 text-sm font-black text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Tải .txt
              </button>
              <button
                onClick={() => void saveTranscript()}
                disabled={!transcript.trim() || saving || listening}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-glow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? "Đang lưu..." : "Lưu vào lịch sử"}
              </button>
            </div>
          </section>

          <aside className="space-y-5">
            <QuotaStatusPanel
              refreshKey={quotaRefreshKey}
              onQuotaChange={setQuota}
            />

            <div className="rounded-2xl border border-border bg-card/80 p-5 shadow-soft">
              <h2 className="flex items-center gap-2 text-lg font-black">
                <Languages className="h-5 w-5 text-primary" />
                Cấu hình realtime
              </h2>
              <div className="mt-4 space-y-4">
                <label className="block text-sm font-bold">
                  Ngôn ngữ nói
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    disabled={listening}
                    className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary"
                  >
                    {SPEECH_LANGUAGE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-bold">
                  Dịch sau khi lưu
                  <select
                    value={translateTo}
                    onChange={(e) => setTranslateTo(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary"
                  >
                    {TRANSLATION_LANGUAGE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/80 p-5 shadow-soft">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
                Giới hạn phiên
              </p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Realtime dùng quota theo số giây bạn nói. Còn lại:{" "}
                <span className="font-black text-foreground">
                  {formatQuotaTime(quota?.remainingSeconds ?? 0)}
                </span>
                .
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Lưu ý: bản realtime dùng Web Speech API của trình duyệt ở V2
                local. Khi production nên nâng cấp thành backend WebSocket proxy
                tới Deepgram Streaming.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
