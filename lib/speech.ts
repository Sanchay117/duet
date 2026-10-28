"use client";

const LANG: Record<string, string> = {
  hindi: "hi-IN",
  urdu: "ur-PK",
  bengali: "bn-IN",
  bangla: "bn-IN",
  tamil: "ta-IN",
  telugu: "te-IN",
  marathi: "mr-IN",
  gujarati: "gu-IN",
  punjabi: "pa-IN",
  kannada: "kn-IN",
  malayalam: "ml-IN",
  spanish: "es-MX",
  portuguese: "pt-BR",
  french: "fr-FR",
  italian: "it-IT",
  german: "de-DE",
  greek: "el-GR",
  polish: "pl-PL",
  russian: "ru-RU",
  arabic: "ar-SA",
  turkish: "tr-TR",
  chinese: "zh-CN",
  mandarin: "zh-CN",
  cantonese: "zh-HK",
  japanese: "ja-JP",
  korean: "ko-KR",
  tagalog: "fil-PH",
  filipino: "fil-PH",
  vietnamese: "vi-VN",
  yiddish: "yi",
  hebrew: "he-IL",
};

export function langCode(language?: string) {
  if (!language) return "en-US";
  return LANG[language.trim().toLowerCase()] ?? "en-US";
}

/** Read text aloud slowly, in the right voice when the browser has one. */
export function speak(text: string, lang = "en-US") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.82;
  u.pitch = 1;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
  return true;
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
