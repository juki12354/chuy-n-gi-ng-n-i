import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Check,
  CircleHelp,
  Copy,
  Download,
  FileAudio,
  Heart,
  Home,
  Image,
  Inbox,
  MessageCircle,
  MessageSquare,
  Mic,
  Paperclip,
  Pause,
  Play,
  RotateCcw,
  Search,
  Send,
  Smile,
  Square,
  X,
  Zap,
} from "lucide-react";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { useAuth } from "@/context/AuthContext";
import { AuthenticatedHeader } from "@/components/auth-app-header";
import {
  TranscriptSegments,
  type TranscriptSegment,
} from "@/components/transcript-segments";
import { QuotaStatusPanel } from "@/components/quota-status-panel";
import { formatQuotaTime, type QuotaStatus } from "@/lib/quota";
import {
  SPEECH_LANGUAGE_OPTIONS,
  TRANSLATION_LANGUAGE_OPTIONS,
  languageLabel,
  type TranslationResult,
} from "@/lib/language-options";
import { downloadSrt } from "@/lib/srt";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:3001";

interface Word {
  text: string;
  start: number;
  end: number;
}

type SpeakerNames = Record<string, string>;

type RecordStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "paused"
  | "recorded"
  | "processing"
  | "done"
  | "error";

type HelpView = "home" | "messages" | "chat" | "help";
type MicAccessStatus =
  | "checking"
  | "ready"
  | "prompt"
  | "blocked"
  | "unsupported";

export const Route = createFileRoute("/record")({
  component: RecordPage,
});

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function getRecorderLabel(status: RecordStatus) {
  if (status === "recording") return "RECORDING";
  if (status === "paused") return "PAUSED";
  if (status === "recorded") return "RECORDED";
  if (status === "processing") return "PROCESSING";
  if (status === "done") return "TRANSCRIBED";
  if (status === "error") return "ERROR";
  return "READY WHEN YOU ARE";
}

function getProcessingEstimate(seconds: number) {
  return Math.max(8, Math.ceil(seconds * 0.35));
}

function RecordPage() {
  const { user, isLoading, token } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<RecordStatus>("idle");
  const [recordTime, setRecordTime] = useState(0);
  const [transcription, setTranscription] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioMime, setAudioMime] = useState("audio/webm");
  const [speakerLabels, setSpeakerLabels] = useState(false);
  const [transcriptionLanguage, setTranscriptionLanguage] = useState("auto");
  const [translateTo, setTranslateTo] = useState("none");
  const [translation, setTranslation] = useState<TranslationResult | null>(
    null,
  );
  const [translationError, setTranslationError] = useState("");
  const [words, setWords] = useState<Word[]>([]);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [speakerNames, setSpeakerNames] = useState<SpeakerNames>({});
  const [currentTranscriptionId, setCurrentTranscriptionId] = useState<
    number | null
  >(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpView, setHelpView] = useState<HelpView>("home");
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [quotaRefreshKey, setQuotaRefreshKey] = useState(0);
  const [micStatus, setMicStatus] = useState<MicAccessStatus>("checking");
  const [micStatusMessage, setMicStatusMessage] = useState(
    "Đang kiểm tra microphone...",
  );
  const [micDeviceLabel, setMicDeviceLabel] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioWarning, setAudioWarning] = useState("");
  const [recordingNotice, setRecordingNotice] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const silenceStartedAtRef = useRef<number | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const recordedBlobRef = useRef<Blob | null>(null);
  const recordedMimeRef = useRef<string>("audio/webm");
  const audioRef = useRef<HTMLAudioElement>(null);
  const editRef = useRef<HTMLDivElement>(null);
  const spanRefs = useRef<HTMLSpanElement[]>([]);
  const activeIdxRef = useRef(-1);

  useEffect(() => {
    if (!isLoading && !user) {
      void navigate({
        to: "/login",
        search: { error: undefined, from: "/record" },
      });
    }
  }, [user, isLoading, navigate]);

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
      if (timerRef.current) clearInterval(timerRef.current);
      stopAudioMonitor();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  useEffect(() => {
    void checkMicrophoneStatus();
  }, []);

  async function loadMicrophoneLabel() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mic = devices.find((device) => device.kind === "audioinput");
      setMicDeviceLabel(mic?.label || "Microphone mặc định");
    } catch {
      setMicDeviceLabel("Microphone mặc định");
    }
  }

  async function checkMicrophoneStatus() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicStatus("unsupported");
      setMicStatusMessage(
        "Trình duyệt này chưa hỗ trợ ghi âm. Hãy dùng Chrome, Edge hoặc trình duyệt mới hơn.",
      );
      return;
    }

    setMicStatus("checking");
    setMicStatusMessage("Đang kiểm tra quyền microphone...");

    try {
      if (navigator.permissions?.query) {
        const permission = await navigator.permissions.query({
          name: "microphone" as PermissionName,
        });

        if (permission.state === "denied") {
          setMicStatus("blocked");
          setMicStatusMessage(
            "Microphone đang bị chặn. Hãy mở quyền microphone trong trình duyệt rồi tải lại trang.",
          );
          return;
        }

        if (permission.state === "granted") {
          setMicStatus("ready");
          setMicStatusMessage(
            "Microphone access is already allowed - you're ready to record.",
          );
          await loadMicrophoneLabel();
          return;
        }
      }

      setMicStatus("prompt");
      setMicStatusMessage(
        "Nhấn Start Recording để cấp quyền microphone và bắt đầu ghi âm.",
      );
    } catch {
      setMicStatus("prompt");
      setMicStatusMessage(
        "Nhấn Start Recording để cấp quyền microphone và bắt đầu ghi âm.",
      );
    }
  }

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

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRecordTime((t) => {
        const next = t + 1;
        const maxSeconds = quota
          ? Math.min(quota.remainingSeconds, quota.limits.maxRecordSeconds)
          : null;
        if (maxSeconds && next >= maxSeconds) {
          setRecordingNotice(
            "Vbee đã tự dừng ghi âm vì phiên này chạm giới hạn quota/gói cước.",
          );
          window.setTimeout(() => stopRecording(), 0);
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

  function stopAudioMonitor() {
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    silenceStartedAtRef.current = null;
    setAudioLevel(0);
    setAudioWarning("");
  }

  function startAudioMonitor(stream: MediaStream) {
    stopAudioMonitor();
    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextCtor) return;

    const context = new AudioContextCtor();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    audioContextRef.current = context;

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const value of data) {
        const normalized = (value - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / data.length);
      const level = Math.min(100, Math.round(rms * 240));
      setAudioLevel(level);

      if (level < 3) {
        if (!silenceStartedAtRef.current) {
          silenceStartedAtRef.current = performance.now();
        }
        if (performance.now() - silenceStartedAtRef.current > 3500) {
          setAudioWarning(
            "Âm thanh đang quá nhỏ. Hãy nói gần microphone hơn hoặc kiểm tra thiết bị thu âm.",
          );
        }
      } else {
        silenceStartedAtRef.current = null;
        setAudioWarning(
          level > 82
            ? "Âm lượng khá lớn, có thể bị rè. Hãy nói nhỏ hơn hoặc đặt mic xa hơn một chút."
            : "",
        );
      }

      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    tick();
  }

  async function startRecording() {
    if (quota?.isLimitReached) {
      setError(
        "Free đã hết 30 phút. Vui lòng nâng cấp Premium để ghi âm tiếp.",
      );
      setStatus("error");
      return;
    }
    if (quota && quota.remainingSeconds <= 0) {
      setError("Bạn không còn quota để ghi âm.");
      setStatus("error");
      return;
    }
    if (micStatus === "blocked" || micStatus === "unsupported") {
      setError(micStatusMessage);
      setStatus("error");
      return;
    }
    setStatus("requesting");
    setError("");
    setRecordingNotice("");
    setAudioWarning("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const track = stream.getAudioTracks()[0];
      setMicStatus("ready");
      setMicDeviceLabel(track?.label || "Microphone mặc định");
      setMicStatusMessage(
        "Microphone access is allowed - you're ready to record.",
      );

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => onRecordStop(mimeType);

      recorder.start(250);
      setStatus("recording");
      setRecordTime(0);
      startTimer();
      startAudioMonitor(stream);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Không thể truy cập microphone";
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setMicStatus("blocked");
      }
      setError(
        msg.includes("Permission") ||
          msg.includes("denied") ||
          name === "NotAllowedError"
          ? "Trình duyệt chưa cấp quyền microphone. Vui lòng cho phép quyền truy cập."
          : `Lỗi microphone: ${msg}`,
      );
      setStatus("error");
    }
  }

  function stopRecording() {
    stopTimer();
    stopAudioMonitor();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  function pauseRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.pause();
    stopTimer();
    stopAudioMonitor();
    setStatus("paused");
  }

  function resumeRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    recorder.resume();
    startTimer();
    if (streamRef.current) startAudioMonitor(streamRef.current);
    setStatus("recording");
  }

  function onRecordStop(mimeType: string) {
    const blob = new Blob(chunksRef.current, { type: mimeType });
    if (blob.size === 0) {
      setError("Không có âm thanh nào được ghi.");
      setStatus("error");
      return;
    }

    recordedBlobRef.current = blob;
    recordedMimeRef.current = mimeType;

    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const url = URL.createObjectURL(blob);
    audioUrlRef.current = url;
    setAudioUrl(url);
    setAudioMime(mimeType);
    setStatus("recorded");
    setMicStatusMessage("Bản ghi đã sẵn sàng. Bạn có thể nghe lại trước khi chuyển thành văn bản.");
  }

  async function startTranscription() {
    const blob = recordedBlobRef.current;
    if (!blob) return;

    setStatus("processing");
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");
    formData.append("speakerLabels", String(speakerLabels));
    formData.append("source", "recording");
    formData.append("expectedDuration", String(Math.max(1, recordTime)));
    formData.append("language", transcriptionLanguage);
    formData.append("translateTo", translateTo);
    try {
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
        segments?: TranscriptSegment[];
        speaker_names?: SpeakerNames;
        quota?: QuotaStatus;
        processingSeconds?: number;
        translation?: TranslationResult | null;
        translationError?: string;
      };
      if (!res.ok) {
        if (data.quota) setQuota(data.quota);
        setError(data.error ?? "Chuyển đổi thất bại");
        setStatus("error");
        return;
      }
      setTranscription(data.text ?? "");
      setTranslation(data.translation ?? null);
      setTranslationError(data.translationError ?? "");
      setDuration(data.duration ?? null);
      setWords(data.words ?? []);
      setSegments(data.segments ?? []);
      setSpeakerNames(data.speaker_names ?? {});
      setCurrentTranscriptionId(data.id ?? null);
      if (data.quota) setQuota(data.quota);
      setQuotaRefreshKey((key) => key + 1);
      setStatus("done");
    } catch {
      setError("Không thể kết nối đến server");
      setStatus("error");
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
    a.download = "recording.docx";
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
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recording.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadSrt() {
    downloadSrt("recording", words, segments, speakerNames);
  }

  async function handleRenameSpeaker(speaker: string, name: string) {
    if (!currentTranscriptionId || !token) return;
    const response = await fetch(
      `${API_URL}/api/transcribe/${currentTranscriptionId}/speakers`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ speaker, name }),
      },
    );
    const data = (await response.json()) as {
      error?: string;
      speakerNames?: SpeakerNames;
      segments?: TranscriptSegment[];
      text?: string;
    };
    if (!response.ok) {
      setError(data.error ?? "Không thể đổi tên người nói");
      return;
    }
    setSpeakerNames(data.speakerNames ?? {});
    if (data.segments) setSegments(data.segments);
    if (data.text) setTranscription(data.text);
  }

  function handleDownloadAudio() {
    if (!audioUrl) return;
    const ext = audioMime.includes("webm") ? "webm" : "ogg";
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `recording.${ext}`;
    a.click();
  }

  function reset() {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    recordedBlobRef.current = null;
    stopTimer();
    stopAudioMonitor();
    setAudioUrl(null);
    setWords([]);
    setSegments([]);
    setSpeakerNames({});
    setCurrentTranscriptionId(null);
    if (editRef.current) editRef.current.innerHTML = "";
    spanRefs.current = [];
    activeIdxRef.current = -1;
    setStatus("idle");
    setRecordTime(0);
    setTranscription("");
    setTranslation(null);
    setTranslationError("");
    setError("");
    setRecordingNotice("");
    setDuration(null);
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

      <main className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
        <section className="mx-auto max-w-2xl">
          <RecorderPanel status={status} recordTime={recordTime} />

          <div className="mt-5">
            <QuotaStatusPanel
              compact
              refreshKey={quotaRefreshKey}
              onQuotaChange={setQuota}
            />
            <RecorderReadinessPanel
              micStatus={micStatus}
              micStatusMessage={micStatusMessage}
              micDeviceLabel={micDeviceLabel}
              audioLevel={audioLevel}
              audioWarning={audioWarning}
              recordTime={recordTime}
              status={status}
              quota={quota}
              onCheckMicrophone={() => void checkMicrophoneStatus()}
            />
            {quota && (
              <p className="mt-3 text-center text-xs font-semibold text-muted-foreground">
                Ghi âm tối đa:{" "}
                {formatQuotaTime(
                  Math.min(
                    quota.remainingSeconds,
                    quota.limits.maxRecordSeconds,
                  ),
                )}{" "}
                cho phiên hiện tại.
              </p>
            )}
            {recordingNotice && (
              <p className="mt-3 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-center text-sm font-bold text-primary">
                {recordingNotice}
              </p>
            )}
          </div>

          <div className="mt-8 flex flex-col items-center gap-4 text-center">
            {status === "idle" && (
              <>
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => void startRecording()}
                    disabled={
                      quota?.isLimitReached ||
                      micStatus === "blocked" ||
                      micStatus === "unsupported"
                    }
                    className="inline-flex items-center gap-3 rounded-full bg-primary px-8 py-4 text-lg font-black text-primary-foreground shadow-glow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Mic className="h-6 w-6" />
                    {quota?.isLimitReached
                      ? "Upgrade to Record"
                      : micStatus === "blocked"
                        ? "Microphone bị chặn"
                        : "Start Recording"}
                  </button>
                </div>
                <p className="max-w-xl text-lg leading-8 text-muted-foreground">
                  {quota?.isLimitReached
                    ? "Free đã hết thời lượng. Nâng cấp Premium để ghi âm tiếp."
                    : "Microphone access is ready - you're ready to record."}
                </p>
              </>
            )}

            {status === "requesting" && (
              <p className="text-lg font-semibold text-muted-foreground">
                Đang yêu cầu quyền microphone...
              </p>
            )}

            {status === "recording" && (
              <div className="grid w-full gap-3 sm:grid-cols-2">
                <button
                  onClick={pauseRecording}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-4 text-sm font-black transition hover:bg-primary/10 hover:text-primary"
                >
                  <Pause className="h-5 w-5" />
                  Tạm dừng
                </button>
                <button
                  onClick={stopRecording}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-6 py-4 text-sm font-black text-destructive transition hover:bg-destructive/20"
                >
                  <Square className="h-5 w-5 fill-current" />
                  Dừng ghi âm
                </button>
              </div>
            )}

            {status === "paused" && (
              <div className="grid w-full gap-3 sm:grid-cols-2">
                <button
                  onClick={resumeRecording}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-sm font-black text-primary-foreground shadow-glow transition hover:opacity-90"
                >
                  <Play className="h-5 w-5 fill-current" />
                  Tiếp tục
                </button>
                <button
                  onClick={stopRecording}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-6 py-4 text-sm font-black text-destructive transition hover:bg-destructive/20"
                >
                  <Square className="h-5 w-5 fill-current" />
                  Dừng ghi âm
                </button>
              </div>
            )}

            {status === "recorded" && (
              <RecordedActions
                audioUrl={audioUrl}
                speakerLabels={speakerLabels}
                setSpeakerLabels={setSpeakerLabels}
                transcriptionLanguage={transcriptionLanguage}
                setTranscriptionLanguage={setTranscriptionLanguage}
                translateTo={translateTo}
                setTranslateTo={setTranslateTo}
                handleDownloadAudio={handleDownloadAudio}
                startTranscription={startTranscription}
                reset={reset}
              />
            )}

            {status === "processing" && (
              <div className="rounded-2xl border border-primary/25 bg-card p-6 text-center shadow-soft">
                <span className="mx-auto block h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                <p className="mt-3 font-bold text-primary">
                  Đang chuyển giọng nói thành văn bản...
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ước tính khoảng {formatTime(getProcessingEstimate(recordTime))}. Vui lòng giữ trang này trong lúc xử lý.
                </p>
              </div>
            )}

            {status === "error" && (
              <div className="w-full rounded-2xl border border-destructive/25 bg-destructive/10 p-5 text-left">
                <div className="mb-3 flex items-start gap-3 text-destructive">
                  <X className="mt-0.5 h-5 w-5 shrink-0" />
                  <p className="text-sm font-semibold">{error}</p>
                </div>
                <button
                  onClick={reset}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-black transition hover:bg-primary/10 hover:text-primary"
                >
                  <RotateCcw className="h-4 w-4" />
                  Thử lại
                </button>
                {recordedBlobRef.current && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <button
                      onClick={() => void startTranscription()}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-glow transition hover:opacity-90"
                    >
                      <Zap className="h-4 w-4" />
                      Transcribe lại
                    </button>
                    <button
                      onClick={() => setStatus("recorded")}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-black transition hover:bg-primary/10 hover:text-primary"
                    >
                      <Play className="h-4 w-4" />
                      Quay lại preview
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {status === "done" && (
            <TranscriptResult
              audioUrl={audioUrl}
              audioRef={audioRef}
              handleTimeUpdate={handleTimeUpdate}
              words={words}
              segments={segments}
              speakerNames={speakerNames}
              handleRenameSpeaker={handleRenameSpeaker}
              editRef={editRef}
              transcription={transcription}
              setTranscription={setTranscription}
              translation={translation}
              translationError={translationError}
              copied={copied}
              handleCopy={handleCopy}
              handleDownloadAudio={handleDownloadAudio}
              handleDownloadTxt={handleDownloadTxt}
              handleDownloadSrt={handleDownloadSrt}
              handleDownload={handleDownload}
              duration={duration}
              recordTime={recordTime}
              reset={reset}
            />
          )}
        </section>
      </main>

      <SonixStyleFooter />
    </div>
  );
}

function RecorderPanel({
  status,
  recordTime,
}: {
  status: RecordStatus;
  recordTime: number;
}) {
  const active = status === "recording" || status === "processing";
  const recorded = status === "recorded" || status === "done";

  return (
    <div className="overflow-hidden rounded-none border border-border bg-card shadow-soft sm:rounded-2xl">
      <div className="flex items-center justify-center gap-3 bg-primary px-5 py-4 text-2xl font-black uppercase tracking-wide text-primary-foreground">
        <Mic className="h-7 w-7" />
        Record
      </div>
      <div className="relative flex min-h-[460px] flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,rgba(255,203,5,0.16),transparent_34%),linear-gradient(180deg,#2b155f_0%,#17092f_100%)] px-6">
        <div
          className={`flex h-52 w-52 items-center justify-center rounded-full border-8 ${
            status === "error" ? "border-destructive" : "border-primary"
          } shadow-[0_0_55px_rgba(255,203,5,.48)] transition ${
            active ? "scale-105 animate-pulse" : ""
          }`}
        >
          {recorded && <Check className="h-20 w-20 text-primary" />}
          {status === "error" && <X className="h-20 w-20 text-destructive" />}
        </div>

        <p className="mt-24 text-center text-lg font-black uppercase tracking-wide text-muted-foreground">
          {getRecorderLabel(status)}
        </p>

        <div className="absolute inset-x-0 bottom-0 flex h-16 items-center justify-end border-t border-white/20 bg-black/45 px-8">
          <span className="font-mono text-2xl font-black tracking-widest text-white">
            {formatTime(recordTime)}
          </span>
        </div>
      </div>
    </div>
  );
}

function RecorderReadinessPanel({
  micStatus,
  micStatusMessage,
  micDeviceLabel,
  audioLevel,
  audioWarning,
  recordTime,
  status,
  quota,
  onCheckMicrophone,
}: {
  micStatus: MicAccessStatus;
  micStatusMessage: string;
  micDeviceLabel: string;
  audioLevel: number;
  audioWarning: string;
  recordTime: number;
  status: RecordStatus;
  quota: QuotaStatus | null;
  onCheckMicrophone: () => void;
}) {
  const isLive = status === "recording";
  const remainingAfterRecord = quota
    ? Math.max(0, quota.remainingSeconds - recordTime)
    : null;
  const sessionLimit = quota
    ? Math.min(quota.remainingSeconds, quota.limits.maxRecordSeconds)
    : null;
  const nearLimit =
    Boolean(quota && isLive && remainingAfterRecord !== null) &&
    remainingAfterRecord <= Math.max(30, quota!.alertSeconds);
  const statusColor =
    micStatus === "ready"
      ? "text-primary"
      : micStatus === "blocked" || micStatus === "unsupported"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-3 text-left">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <p className={`text-sm font-black uppercase tracking-wide ${statusColor}`}>
              {micStatus === "checking"
                ? "Đang kiểm tra mic"
                : micStatus === "ready"
                  ? "Microphone sẵn sàng"
                  : micStatus === "prompt"
                    ? "Chờ cấp quyền microphone"
                    : micStatus === "blocked"
                      ? "Microphone bị chặn"
                      : "Trình duyệt chưa hỗ trợ"}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {micStatusMessage}
            </p>
            {micDeviceLabel && (
              <p className="mt-1 text-xs font-semibold text-muted-foreground/80">
                Thiết bị: {micDeviceLabel}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onCheckMicrophone}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-black transition hover:border-primary/50 hover:text-primary"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Kiểm tra mic
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-background/35 p-3">
          <p className="text-xs font-black uppercase text-muted-foreground">
            Âm lượng realtime
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${
                audioWarning && isLive ? "bg-destructive" : "bg-primary"
              }`}
              style={{ width: `${isLive ? Math.max(audioLevel, 2) : 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-semibold text-muted-foreground">
            {isLive
              ? audioWarning || "Mic đang thu âm ổn định."
              : "Bắt đầu ghi để xem mức âm."}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-background/35 p-3">
          <p className="text-xs font-black uppercase text-muted-foreground">
            Giới hạn phiên
          </p>
          <p className="mt-2 text-lg font-black text-foreground">
            {sessionLimit ? formatQuotaTime(sessionLimit) : "Đang tải"}
          </p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            Theo quota và giới hạn gói hiện tại.
          </p>
        </div>

        <div
          className={`rounded-xl border p-3 ${
            nearLimit
              ? "border-destructive/30 bg-destructive/10"
              : "border-border bg-background/35"
          }`}
        >
          <p className="text-xs font-black uppercase text-muted-foreground">
            Còn lại sau phiên
          </p>
          <p className="mt-2 text-lg font-black text-foreground">
            {remainingAfterRecord !== null
              ? formatQuotaTime(remainingAfterRecord)
              : "Đăng nhập"}
          </p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            {nearLimit
              ? "Sắp hết quota, Vbee có thể tự dừng ghi âm."
              : "Quota được trừ theo số giây ghi âm."}
          </p>
        </div>
      </div>
    </div>
  );
}

function RecordedActions({
  audioUrl,
  speakerLabels,
  setSpeakerLabels,
  transcriptionLanguage,
  setTranscriptionLanguage,
  translateTo,
  setTranslateTo,
  handleDownloadAudio,
  startTranscription,
  reset,
}: {
  audioUrl: string | null;
  speakerLabels: boolean;
  setSpeakerLabels: (checked: boolean) => void;
  transcriptionLanguage: string;
  setTranscriptionLanguage: (value: string) => void;
  translateTo: string;
  setTranslateTo: (value: string) => void;
  handleDownloadAudio: () => void;
  startTranscription: () => Promise<void>;
  reset: () => void;
}) {
  return (
    <div className="w-full space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
      {audioUrl && (
        <div className="rounded-xl border border-border bg-background/45 p-4">
          <p className="mb-3 text-xs font-semibold text-muted-foreground">
            Nghe lại bản ghi âm
          </p>
          <audio controls src={audioUrl} className="w-full" />
        </div>
      )}

      <label className="flex items-center justify-between rounded-xl border border-border bg-background/45 px-4 py-3 text-left">
        <div>
          <p className="text-sm font-bold">Gắn nhãn người nói</p>
          <p className="text-xs text-muted-foreground">
            Phân biệt từng người trong đoạn ghi âm
          </p>
        </div>
        <span
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
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
          <span className="text-sm font-bold">Ngôn ngữ âm thanh</span>
          <select
            value={transcriptionLanguage}
            onChange={(e) => setTranscriptionLanguage(e.target.value)}
            className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
          >
            {SPEECH_LANGUAGE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="rounded-xl border border-border bg-background/45 px-4 py-3 text-left">
          <span className="text-sm font-bold">Dịch văn bản sang</span>
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

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          onClick={handleDownloadAudio}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-black transition hover:bg-primary/10 hover:text-primary"
        >
          <Download className="h-4 w-4" />
          Audio
        </button>
        <button
          onClick={() => void startTranscription()}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-glow transition hover:opacity-90"
        >
          <Zap className="h-4 w-4" />
          Chuyển đổi
        </button>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-black transition hover:bg-card"
        >
          <RotateCcw className="h-4 w-4" />
          Ghi lại
        </button>
      </div>
    </div>
  );
}

function TranscriptResult({
  audioUrl,
  audioRef,
  handleTimeUpdate,
  words,
  segments,
  speakerNames,
  handleRenameSpeaker,
  editRef,
  transcription,
  setTranscription,
  translation,
  translationError,
  copied,
  handleCopy,
  handleDownloadAudio,
  handleDownloadTxt,
  handleDownloadSrt,
  handleDownload,
  duration,
  recordTime,
  reset,
}: {
  audioUrl: string | null;
  audioRef: RefObject<HTMLAudioElement | null>;
  handleTimeUpdate: () => void;
  words: Word[];
  segments: TranscriptSegment[];
  speakerNames: SpeakerNames;
  handleRenameSpeaker: (speaker: string, name: string) => Promise<void>;
  editRef: RefObject<HTMLDivElement | null>;
  transcription: string;
  setTranscription: (value: string) => void;
  translation: TranslationResult | null;
  translationError: string;
  copied: boolean;
  handleCopy: () => Promise<void>;
  handleDownloadAudio: () => void;
  handleDownloadTxt: () => void;
  handleDownloadSrt: () => void;
  handleDownload: () => Promise<void>;
  duration: number | null;
  recordTime: number;
  reset: () => void;
}) {
  return (
    <div className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-4 flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Check className="h-4 w-4 text-primary" />
          <span className="font-bold text-primary">Chuyển đổi thành công</span>
          {duration && (
            <span className="text-muted-foreground">
              · {Math.round(duration)}s âm thanh
            </span>
          )}
          <span className="text-muted-foreground">
            · {formatTime(recordTime)} ghi âm
          </span>
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition hover:text-primary"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Ghi âm lại
        </button>
      </div>

      {audioUrl && (
        <div className="mb-4 rounded-xl border border-border bg-background/45 p-4">
          <p className="mb-3 text-xs font-semibold text-muted-foreground">
            Nghe lại - từ đang phát sẽ được highlight, nhấn vào từ để tua
          </p>
          <audio
            ref={audioRef}
            controls
            src={audioUrl}
            className="w-full"
            onTimeUpdate={handleTimeUpdate}
          />
        </div>
      )}

      <TranscriptSegments
        segments={segments}
        audioRef={audioRef}
        speakerNames={speakerNames}
        onRenameSpeaker={handleRenameSpeaker}
      />

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
              if (editRef.current)
                setTranscription(editRef.current.textContent ?? "");
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
        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 px-5 py-4">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-primary">
            Bản dịch {languageLabel(translation.targetLanguage)}
          </p>
          <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">
            {translation.text}
          </p>
        </div>
      )}

      {translationError && (
        <div className="mt-4 rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
          Transcript gốc đã tạo xong, nhưng chưa dịch được: {translationError}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-5">
        <button
          onClick={() => void handleCopy()}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-black transition hover:border-primary/50 hover:text-primary"
        >
          {copied ? (
            <Check className="h-4 w-4 text-primary" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {copied ? "Đã sao chép" : "Sao chép"}
        </button>
        <button
          onClick={handleDownloadAudio}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-5 py-3 text-sm font-black text-primary transition hover:bg-primary/20"
        >
          <Download className="h-4 w-4" />
          Tải audio
        </button>
        <button
          onClick={handleDownloadTxt}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-5 py-3 text-sm font-black text-primary transition hover:bg-primary/20"
        >
          <Download className="h-4 w-4" />
          Tải .txt
        </button>
        <button
          onClick={handleDownloadSrt}
          disabled={segments.length === 0 && words.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-5 py-3 text-sm font-black text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Download className="h-4 w-4" />
          Tải .srt
        </button>
        <button
          onClick={() => void handleDownload()}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-glow transition hover:opacity-90"
        >
          <Download className="h-4 w-4" />
          Tải .docx
        </button>
      </div>
    </div>
  );
}

const HELP_QUESTIONS = [
  "Cách bắt đầu ghi âm bằng microphone?",
  "Tại sao bản ghi âm chưa có transcript?",
  "Làm sao tải xuống file audio đã ghi?",
  "Có thể nhận diện nhiều người nói không?",
];

const HELP_COLLECTIONS = [
  {
    title: "Ghi âm trực tiếp",
    desc: "Hướng dẫn cấp quyền microphone, tạm dừng và lưu bản ghi",
    articles: "8 bài viết",
  },
  {
    title: "Chất lượng âm thanh",
    desc: "Cách giảm nhiễu, đặt microphone và ghi âm rõ hơn",
    articles: "6 bài viết",
  },
  {
    title: "Chuyển thành văn bản",
    desc: "Các câu hỏi về xử lý transcript, highlight từ và tải .docx",
    articles: "12 bài viết",
  },
  {
    title: "Tài khoản và API",
    desc: "Quản lý lịch sử, API key và tích hợp vào ứng dụng riêng",
    articles: "9 bài viết",
  },
];

function RecordingHelpWidget({
  open,
  view,
  setOpen,
  setView,
  firstName,
}: {
  open: boolean;
  view: HelpView;
  setOpen: (open: boolean) => void;
  setView: (view: HelpView) => void;
  firstName: string;
}) {
  if (!open) {
    return (
      <button
        onClick={() => {
          setView("home");
          setOpen(true);
        }}
        className="fixed bottom-24 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow transition hover:scale-105"
        aria-label="Mở trợ giúp"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed inset-x-3 bottom-24 z-[80] mx-auto max-h-[calc(100vh-7rem)] w-[min(420px,calc(100vw-1.5rem))] overflow-hidden rounded-[1.75rem] border border-border bg-secondary text-secondary-foreground shadow-[0_28px_90px_rgba(0,0,0,.48)] sm:left-auto sm:right-6">
      {view === "home" && (
        <HelpHome firstName={firstName} setOpen={setOpen} setView={setView} />
      )}
      {view === "messages" && (
        <HelpMessages setOpen={setOpen} setView={setView} />
      )}
      {view === "chat" && <HelpChat setOpen={setOpen} setView={setView} />}
      {view === "help" && <HelpCollections setOpen={setOpen} />}
      <HelpBottomNav view={view} setView={setView} />
    </div>
  );
}

function HelpHome({
  firstName,
  setOpen,
  setView,
}: {
  firstName: string;
  setOpen: (open: boolean) => void;
  setView: (view: HelpView) => void;
}) {
  return (
    <>
      <div className="bg-card px-6 pb-16 pt-6 text-foreground">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-bold">
            <FileAudio className="h-5 w-5 text-primary" />
            Vbee
          </div>
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-card bg-primary text-sm font-black text-primary-foreground">
                {firstName[0]?.toUpperCase() ?? "U"}
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-card bg-secondary text-sm font-black text-secondary-foreground">
                AI
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
              aria-label="Đóng trợ giúp"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <h2 className="mt-14 text-3xl font-black leading-tight">
          Hi {firstName}!<br />
          How can we help?
        </h2>
      </div>

      <div className="-mt-10 space-y-3 px-5 pb-6">
        <button
          onClick={() => setView("chat")}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-secondary px-5 py-4 text-left shadow-soft transition hover:border-primary/50"
        >
          <span>
            <span className="block font-black">Send us a message</span>
            <span className="mt-1 block text-sm text-secondary-foreground/65">
              We'll be back online tomorrow
            </span>
          </span>
          <ChevronRight className="h-6 w-6 text-primary" />
        </button>

        <div className="rounded-xl border border-border bg-secondary p-4 shadow-soft">
          <button
            onClick={() => setView("help")}
            className="mb-3 flex w-full items-center justify-between rounded-lg bg-background/10 px-3 py-2 text-left text-sm font-black"
          >
            Search for help
            <Search className="h-4 w-4 text-primary" />
          </button>
          <div className="space-y-1">
            {HELP_QUESTIONS.map((question) => (
              <button
                key={question}
                onClick={() => setView("help")}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-secondary-foreground/72 transition hover:bg-primary/10 hover:text-secondary-foreground"
              >
                <span>{question}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function HelpMessages({
  setOpen,
  setView,
}: {
  setOpen: (open: boolean) => void;
  setView: (view: HelpView) => void;
}) {
  return (
    <>
      <HelpPanelHeader title="Messages" onClose={() => setOpen(false)} />
      <div className="flex min-h-[470px] flex-col items-center justify-center px-6 text-center">
        <MessageSquare className="h-9 w-9 text-secondary-foreground" />
        <h3 className="mt-6 text-xl font-black">No messages</h3>
        <p className="mt-3 text-sm text-secondary-foreground/70">
          Messages from the team will be shown here
        </p>
        <button
          onClick={() => setView("chat")}
          className="mt-auto mb-5 inline-flex items-center gap-3 rounded-xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-glow"
        >
          Send us a message
          <Send className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}

function HelpChat({
  setOpen,
  setView,
}: {
  setOpen: (open: boolean) => void;
  setView: (view: HelpView) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between border-b border-border bg-secondary px-4 py-3">
        <button
          onClick={() => setView("messages")}
          className="rounded-full p-2 text-secondary-foreground/70 transition hover:bg-background/10 hover:text-secondary-foreground"
          aria-label="Quay lại"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-1 items-center gap-3 px-2">
          <div className="flex -space-x-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-secondary bg-primary text-[11px] font-black text-primary-foreground">
              VB
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-secondary bg-card text-[11px] font-black text-foreground">
              AI
            </span>
          </div>
          <div>
            <p className="text-sm font-black">Vbee AI</p>
            <p className="text-xs text-secondary-foreground/60">
              Back tomorrow
            </p>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="rounded-full p-2 text-secondary-foreground/70 transition hover:bg-background/10 hover:text-secondary-foreground"
          aria-label="Đóng trợ giúp"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex min-h-[560px] flex-col bg-secondary">
        <p className="px-8 pt-6 text-center text-sm text-secondary-foreground/75">
          Nice to meet you. How can we help you today?
        </p>
        <div className="mt-auto p-4">
          <div className="rounded-2xl border-2 border-primary bg-secondary p-4">
            <textarea
              rows={2}
              placeholder="Message..."
              className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-secondary-foreground/55"
            />
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-4 text-secondary-foreground/55">
                <Paperclip className="h-4 w-4" />
                <Smile className="h-4 w-4" />
                <Image className="h-4 w-4" />
                <Mic className="h-4 w-4" />
              </div>
              <button className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function HelpCollections({ setOpen }: { setOpen: (open: boolean) => void }) {
  return (
    <>
      <HelpPanelHeader title="Help" onClose={() => setOpen(false)} />
      <div className="px-4 py-4">
        <button className="flex w-full items-center justify-between rounded-lg bg-background/10 px-3 py-3 text-left text-sm">
          Search for help
          <Search className="h-4 w-4 text-primary" />
        </button>
      </div>
      <div className="max-h-[500px] overflow-y-auto border-t border-border px-5 pb-4 scrollbar-primary">
        <h3 className="py-5 text-base font-black">25 collections</h3>
        <div className="divide-y divide-border">
          {HELP_COLLECTIONS.map((item) => (
            <button
              key={item.title}
              className="flex w-full items-start justify-between gap-4 py-4 text-left transition hover:text-primary"
            >
              <span>
                <span className="block font-black">{item.title}</span>
                <span className="mt-2 block text-sm leading-6 text-secondary-foreground/78">
                  {item.desc}
                </span>
                <span className="mt-2 block text-sm text-secondary-foreground/55">
                  {item.articles}
                </span>
              </span>
              <ChevronRight className="mt-7 h-4 w-4 shrink-0 text-primary" />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function HelpPanelHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-secondary px-5 py-4">
      <span className="w-8" />
      <h2 className="text-lg font-black">{title}</h2>
      <button
        onClick={onClose}
        className="rounded-full p-1 text-secondary-foreground/70 transition hover:bg-background/10 hover:text-secondary-foreground"
        aria-label="Đóng trợ giúp"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

function HelpBottomNav({
  view,
  setView,
}: {
  view: HelpView;
  setView: (view: HelpView) => void;
}) {
  const items: Array<{
    view: HelpView;
    label: string;
    icon: typeof Home;
  }> = [
    { view: "home", label: "Home", icon: Home },
    { view: "messages", label: "Messages", icon: Inbox },
    { view: "help", label: "Help", icon: CircleHelp },
  ];

  return (
    <div className="grid grid-cols-3 border-t border-border bg-secondary px-4 py-3">
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          view === item.view || (view === "chat" && item.view === "messages");
        return (
          <button
            key={item.view}
            onClick={() => setView(item.view)}
            className={`flex flex-col items-center gap-1 text-sm font-semibold transition ${
              active ? "text-primary" : "text-secondary-foreground/60"
            }`}
          >
            <Icon className="h-5 w-5" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function SonixStyleFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-card/70 px-4 py-8 text-center text-sm text-muted-foreground">
      <p>© 2026 Vbee Voice. All rights reserved.</p>
      <div className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-2 font-semibold text-primary">
        <Link to="/">Home</Link>
        <Link to="/pricing">Pricing</Link>
        <Link to="/upload">Upload</Link>
        <Link to="/api">API</Link>
        <Link to="/dashboard" search={{ token: undefined }}>
          Studio
        </Link>
      </div>
      <p className="mt-5 inline-flex items-center justify-center gap-2">
        Made with <Heart className="h-4 w-4 text-primary" /> and{" "}
        <FileAudio className="h-4 w-4 text-primary" /> in your AI voice studio
      </p>
    </footer>
  );
}
