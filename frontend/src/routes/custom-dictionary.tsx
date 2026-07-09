import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, HelpCircle, X } from "lucide-react";
import { AuthenticatedHeader } from "@/components/auth-app-header";
import {
  SonixPreferencesFooter,
  SonixPreferencesSidebar,
} from "@/components/sonix-preferences-layout";
import { useAuth } from "@/context/AuthContext";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:3001";

interface SettingsPayload {
  customDictionary: string;
  entriesCount?: number;
  error?: string;
}

export const Route = createFileRoute("/custom-dictionary")({
  component: CustomDictionaryPage,
});

function countEntries(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function CustomDictionaryPage() {
  const { user, isLoading, token } = useAuth();
  const navigate = useNavigate();
  const [dictionary, setDictionary] = useState("");
  const [savedDictionary, setSavedDictionary] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      void navigate({
        to: "/login",
        search: { error: undefined, from: "/custom-dictionary" },
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
        setDictionary(data.customDictionary || "");
        setSavedDictionary(data.customDictionary || "");
      })
      .catch((loadError: unknown) => {
        if (ignore) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không tải được custom dictionary",
        );
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [token]);

  const entryCount = useMemo(() => countEntries(dictionary), [dictionary]);
  const lineCount = Math.max(1, dictionary.split(/\r?\n/).length);
  const isOverLimit = entryCount > 400;

  async function handleSave() {
    if (!token || isOverLimit) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/settings/dictionary`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ customDictionary: dictionary }),
      });
      const data = (await res.json()) as SettingsPayload;
      if (!res.ok) throw new Error(data.error || "Không lưu được dictionary");
      setDictionary(data.customDictionary || "");
      setSavedDictionary(data.customDictionary || "");
      setMessage(`Đã lưu ${data.entriesCount ?? entryCount} mục dictionary`);
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Không lưu được custom dictionary",
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
              Custom dictionary
            </h1>
          </div>

          <div className="max-w-3xl">
            <p className="text-sm leading-7 text-muted-foreground">
              Add words or phrases that commonly occur in your files and Vbee
              will prioritize them while transcribing. Proper names, technical
              terms, uncommon phrases, and unique spellings are all welcome.
            </p>

            <div className="mt-8">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-black uppercase tracking-[0.08em]">
                    Main custom dictionary
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">
                    One word or phrase per line. Applies to all languages. Limit
                    400 entries.
                  </p>
                </div>
                <span
                  className={`text-sm font-black ${
                    isOverLimit ? "text-destructive" : "text-primary"
                  }`}
                >
                  {entryCount}/400
                </span>
              </div>

              <div className="overflow-hidden rounded-t-xl border border-border bg-card/70">
                <div className="grid min-h-[360px] grid-cols-[48px_1fr]">
                  <div className="select-none border-r border-border bg-background/45 px-3 py-4 text-right font-mono text-xs leading-6 text-muted-foreground/70">
                    {Array.from({ length: lineCount }, (_, index) => (
                      <div key={index}>{index + 1}</div>
                    ))}
                  </div>
                  <textarea
                    value={dictionary}
                    onChange={(event) => setDictionary(event.target.value)}
                    placeholder="One word/phrase per line, please!"
                    className="min-h-[360px] w-full resize-y bg-transparent px-4 py-4 font-mono text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground/50"
                    spellCheck={false}
                  />
                </div>
              </div>

              <div className="rounded-b-xl border-x border-b border-border bg-primary/10 px-5 py-4">
                <div className="flex gap-3 text-sm leading-6">
                  <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p className="text-muted-foreground">
                    <span className="font-black text-foreground">
                      Quickly add new words to Main Custom Dictionary:
                    </span>{" "}
                    while editing a transcript, highlight a word or phrase and
                    save it here for later jobs.
                  </p>
                </div>
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
              {isOverLimit && (
                <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
                  Dictionary vượt 400 mục. Hãy rút gọn trước khi lưu.
                </div>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => void handleSave()}
                  disabled={saving || isOverLimit}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-glow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <Check className="h-4 w-4" />
                  {saving ? "SAVING..." : "SAVE MAIN CUSTOM DICTIONARY"}
                </button>
                <button
                  onClick={() => {
                    setDictionary(savedDictionary);
                    setMessage("");
                    setError("");
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card/70 px-5 py-3 text-sm font-black text-muted-foreground transition hover:border-primary/50 hover:text-primary"
                >
                  <X className="h-4 w-4" />
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        </section>

        <SonixPreferencesSidebar
          active="dictionary"
          firstName={user.firstName}
        />
      </main>

      <SonixPreferencesFooter />
    </div>
  );
}
