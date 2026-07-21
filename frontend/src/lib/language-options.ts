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
  { value: "en", label: "Tiếng Anh" },
  { value: "es", label: "Tiếng Tây Ban Nha" },
  { value: "de", label: "Tiếng Đức" },
  { value: "fr", label: "Tiếng Pháp" },
  { value: "it", label: "Tiếng Ý" },
  { value: "ja", label: "Tiếng Nhật" },
  { value: "ko", label: "Tiếng Hàn" },
  { value: "zh", label: "Tiếng Trung" },
  { value: "pt", label: "Tiếng Bồ Đào Nha" },
  { value: "id", label: "Tiếng Indonesia" },
  { value: "th", label: "Tiếng Thái" },
  { value: "hi", label: "Tiếng Hindi" },
  { value: "ru", label: "Tiếng Nga" },
  { value: "tr", label: "Tiếng Thổ Nhĩ Kỳ" },
  { value: "uk", label: "Tiếng Ukraina" },
  { value: "pl", label: "Tiếng Ba Lan" },
  { value: "nl", label: "Tiếng Hà Lan" },
  { value: "sv", label: "Tiếng Thụy Điển" },
  { value: "ms", label: "Tiếng Mã Lai" },
];

export const TRANSLATION_LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: "none", label: "Không dịch" },
  { value: "vi", label: "Dịch sang Tiếng Việt" },
  { value: "en", label: "Dịch sang Tiếng Anh" },
  { value: "es", label: "Dịch sang Tiếng Tây Ban Nha" },
  { value: "de", label: "Dịch sang Tiếng Đức" },
  { value: "fr", label: "Dịch sang Tiếng Pháp" },
  { value: "it", label: "Dịch sang Tiếng Ý" },
  { value: "ja", label: "Dịch sang Tiếng Nhật" },
  { value: "ko", label: "Dịch sang Tiếng Hàn" },
  { value: "zh", label: "Dịch sang Tiếng Trung" },
  { value: "pt", label: "Dịch sang Tiếng Bồ Đào Nha" },
  { value: "id", label: "Dịch sang Tiếng Indonesia" },
  { value: "th", label: "Dịch sang Tiếng Thái" },
  { value: "ar", label: "Dịch sang Tiếng Ả Rập" },
  { value: "hi", label: "Dịch sang Tiếng Hindi" },
  { value: "bn", label: "Dịch sang Tiếng Bengal" },
  { value: "ur", label: "Dịch sang Tiếng Urdu" },
  { value: "ru", label: "Dịch sang Tiếng Nga" },
  { value: "uk", label: "Dịch sang Tiếng Ukraina" },
  { value: "tr", label: "Dịch sang Tiếng Thổ Nhĩ Kỳ" },
  { value: "pl", label: "Dịch sang Tiếng Ba Lan" },
  { value: "nl", label: "Dịch sang Tiếng Hà Lan" },
  { value: "sv", label: "Dịch sang Tiếng Thụy Điển" },
  { value: "cs", label: "Dịch sang Tiếng Séc" },
  { value: "da", label: "Dịch sang Tiếng Đan Mạch" },
  { value: "el", label: "Dịch sang Tiếng Hy Lạp" },
  { value: "he", label: "Dịch sang Tiếng Hebrew" },
  { value: "fa", label: "Dịch sang Tiếng Ba Tư" },
  { value: "ms", label: "Dịch sang Tiếng Mã Lai" },
  { value: "ta", label: "Dịch sang Tiếng Tamil" },
  { value: "te", label: "Dịch sang Tiếng Telugu" },
  { value: "sw", label: "Dịch sang Tiếng Swahili" },
];

export function languageLabel(value?: string | null) {
  if (!value) return "";
  return (
    [...SPEECH_LANGUAGE_OPTIONS, ...TRANSLATION_LANGUAGE_OPTIONS].find(
      (item) => item.value === value,
    )?.label ?? value.toUpperCase()
  );
}
