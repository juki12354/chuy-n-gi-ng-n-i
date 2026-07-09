export type LanguageOption = {
  value: string;
  label: string;
};

export type TranslationResult = {
  text: string;
  sourceLanguage?: string | null;
  targetLanguage?: string | null;
  provider?: string | null;
};

export const SPEECH_LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: "auto", label: "Tự nhận diện" },
  { value: "multi", label: "Tự nhận diện nhiều ngôn ngữ" },
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "it", label: "Italiano" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "zh", label: "中文" },
  { value: "pt", label: "Português" },
  { value: "id", label: "Bahasa Indonesia" },
  { value: "th", label: "ไทย" },
  { value: "hi", label: "हिन्दी" },
  { value: "ru", label: "Русский" },
  { value: "tr", label: "Türkçe" },
  { value: "uk", label: "Українська" },
  { value: "pl", label: "Polski" },
  { value: "nl", label: "Nederlands" },
  { value: "sv", label: "Svenska" },
  { value: "ms", label: "Bahasa Melayu" },
];

export const TRANSLATION_LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: "none", label: "Không dịch" },
  { value: "vi", label: "Dịch sang Tiếng Việt" },
  { value: "en", label: "Translate to English" },
  { value: "es", label: "Traducir al español" },
  { value: "de", label: "Ins Deutsche übersetzen" },
  { value: "fr", label: "Traduire en français" },
  { value: "it", label: "Tradurre in italiano" },
  { value: "ja", label: "日本語へ翻訳" },
  { value: "ko", label: "한국어로 번역" },
  { value: "zh", label: "翻译成中文" },
  { value: "pt", label: "Traduzir para português" },
  { value: "id", label: "Terjemahkan ke Indonesia" },
  { value: "th", label: "แปลเป็นภาษาไทย" },
  { value: "ar", label: "ترجمة إلى العربية" },
  { value: "hi", label: "हिन्दी में अनुवाद" },
  { value: "bn", label: "বাংলায় অনুবাদ" },
  { value: "ur", label: "اردو میں ترجمہ" },
  { value: "ru", label: "Перевести на русский" },
  { value: "uk", label: "Перекласти українською" },
  { value: "tr", label: "Türkçeye çevir" },
  { value: "pl", label: "Przetłumacz na polski" },
  { value: "nl", label: "Vertalen naar Nederlands" },
  { value: "sv", label: "Översätt till svenska" },
  { value: "cs", label: "Přeložit do češtiny" },
  { value: "da", label: "Oversæt til dansk" },
  { value: "el", label: "Μετάφραση στα ελληνικά" },
  { value: "he", label: "תרגום לעברית" },
  { value: "fa", label: "ترجمه به فارسی" },
  { value: "ms", label: "Terjemah ke Bahasa Melayu" },
  { value: "ta", label: "தமிழில் மொழிபெயர்" },
  { value: "te", label: "తెలుగులోకి అనువదించు" },
  { value: "sw", label: "Tafsiri kwa Kiswahili" },
];

export function languageLabel(value?: string | null) {
  if (!value) return "";
  return (
    [...SPEECH_LANGUAGE_OPTIONS, ...TRANSLATION_LANGUAGE_OPTIONS].find(
      (item) => item.value === value,
    )?.label ?? value.toUpperCase()
  );
}
