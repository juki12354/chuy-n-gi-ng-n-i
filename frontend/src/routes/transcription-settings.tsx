import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Check, Languages, X } from "lucide-react";
import { AuthenticatedHeader } from "@/components/auth-app-header";
import {
  SonixPreferencesFooter,
  SonixPreferencesSidebar,
} from "@/components/sonix-preferences-layout";
import { useAuth } from "@/context/AuthContext";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:3001";

type TimecodeOffset = "yes" | "no";
type SpellingPreference = "american" | "australian" | "british";
type BinarySetting = "yes" | "no";

interface TranscriptionSettings {
  timecodeOffset: TimecodeOffset;
  spellingPreference: SpellingPreference;
  fillerWords: BinarySetting;
  profanityFilter: BinarySetting;
}

interface SettingsPayload {
  transcriptionSettings: TranscriptionSettings;
  error?: string;
}

const DEFAULT_SETTINGS: TranscriptionSettings = {
  timecodeOffset: "no",
  spellingPreference: "american",
  fillerWords: "yes",
  profanityFilter: "no",
};

export const Route = createFileRoute("/transcription-settings")({
  component: TranscriptionSettingsPage,
});

function SettingBlock({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-border py-7 last:border-b-0">
      {eyebrow && (
        <p className="mb-2 text-sm font-semibold text-muted-foreground">
          {eyebrow}
        </p>
      )}
      <h2 className="text-lg font-black uppercase tracking-[0.08em]">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
        {description}
      </p>
      <div className="mt-3 max-w-2xl">{children}</div>
    </div>
  );
}

function TranscriptionSettingsPage() {
  const { user, isLoading, token } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] =
    useState<TranscriptionSettings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] =
    useState<TranscriptionSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      void navigate({
        to: "/login",
        search: { error: undefined, from: "/transcription-settings" },
      });
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (!token) return;
    let ignore = false;
    setLoading(true);
    setError("");
    void fetch(`${API_URL}/api/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = (await res.json()) as SettingsPayload;
        if (!res.ok) throw new Error(data.error || "Không tải được settings");
        if (ignore) return;
        const next = data.transcriptionSettings || DEFAULT_SETTINGS;
        setSettings(next);
        setSavedSettings(next);
      })
      .catch((loadError: unknown) => {
        if (ignore) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không tải được transcription settings",
        );
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [token]);

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/settings/transcription`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ transcriptionSettings: settings }),
      });
      const data = (await res.json()) as SettingsPayload;
      if (!res.ok) throw new Error(data.error || "Không lưu được settings");
      const next = data.transcriptionSettings || settings;
      setSettings(next);
      setSavedSettings(next);
      setMessage("Đã lưu transcription settings");
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Không lưu được transcription settings",
      );
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || loading) {
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

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0">
          <div className="mb-6 border-b-4 border-primary pb-5">
            <h1 className="text-3xl font-light tracking-tight md:text-5xl">
              Transcription settings
            </h1>
          </div>

          <div className="max-w-3xl rounded-2xl border border-border bg-card/75 px-5 shadow-soft sm:px-7">
            <SettingBlock
              title="Automatically adjust timecode from metadata"
              description="Timecode offsets change the start time of a file and affect all word timestamps. You can keep every transcript starting at 00:00:00.000 or let the system use media metadata."
            >
              <select
                value={settings.timecodeOffset}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    timecodeOffset: event.target.value as TimecodeOffset,
                  }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-3 text-sm font-semibold outline-none transition focus:border-primary"
              >
                <option value="yes">
                  YES: Automatically adjust timecode offset
                </option>
                <option value="no">
                  NO: Start all files at 00:00:00.000 (default)
                </option>
              </select>
            </SettingBlock>

            <SettingBlock
              eyebrow="🇺🇸 🇬🇧 🇦🇺 English transcripts only"
              title="English spelling preference"
              description="Custom dictionary words and phrases always take priority. Choose the spelling style to prefer when English transcripts are generated."
            >
              <select
                value={settings.spellingPreference}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    spellingPreference: event.target
                      .value as SpellingPreference,
                  }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-3 text-sm font-semibold outline-none transition focus:border-primary"
              >
                <option value="american">American spelling</option>
                <option value="australian">Australian spelling</option>
                <option value="british">British spelling</option>
              </select>
            </SettingBlock>

            <SettingBlock
              eyebrow="🇺🇸 🇬🇧 🇦🇺 English transcripts only"
              title="Filler words"
              description='Vocal disfluencies or hesitations such as "um", "ah", and "hmm" are used to give the speaker time to think or express uncertainty.'
            >
              <select
                value={settings.fillerWords}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    fillerWords: event.target.value as BinarySetting,
                  }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-3 text-sm font-semibold outline-none transition focus:border-primary"
              >
                <option value="yes">
                  YES: Transcribe filler words (default)
                </option>
                <option value="no">NO: Do not transcribe filler words</option>
              </select>
            </SettingBlock>

            <SettingBlock
              eyebrow="🇺🇸 🇬🇧 🇪🇸 🇲🇽 🇮🇹 English, Spanish, and Italian transcripts only"
              title="Profanity filter"
              description="Obscure profanity by displaying only the initial letter followed by asterisks. This keeps transcript text appropriate for audiences."
            >
              <select
                value={settings.profanityFilter}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    profanityFilter: event.target.value as BinarySetting,
                  }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-3 text-sm font-semibold outline-none transition focus:border-primary"
              >
                <option value="no">
                  NO: Transcribe profane words (default)
                </option>
                <option value="yes">YES: Obscure profane words</option>
              </select>
            </SettingBlock>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-muted-foreground">
            <Languages className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              Các lựa chọn này được lưu theo tài khoản. Với Deepgram, filler
              words và profanity filter được áp dụng trực tiếp khi transcribe;
              spelling/timecode được giữ làm cài đặt workflow cho giao diện.
            </p>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
              {error}
            </div>
          )}
          {message && (
            <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
              {message}
            </div>
          )}

          <div className="mt-5 grid max-w-3xl gap-3 sm:grid-cols-2">
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-glow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Check className="h-4 w-4" />
              {saving ? "SAVING..." : "SAVE TRANSCRIPTION SETTINGS"}
            </button>
            <button
              onClick={() => {
                setSettings(savedSettings);
                setMessage("");
                setError("");
              }}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card/70 px-5 py-3 text-sm font-black text-muted-foreground transition hover:border-primary/50 hover:text-primary"
            >
              <X className="h-4 w-4" />
              CANCEL
            </button>
          </div>
        </section>

        <SonixPreferencesSidebar
          active="transcription"
          firstName={user.firstName}
        />
      </main>

      <SonixPreferencesFooter />
    </div>
  );
}
