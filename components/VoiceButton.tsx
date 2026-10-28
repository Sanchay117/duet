"use client";
import { useRef, useState } from "react";
import { Icon, Spinner } from "./ui";

/** Hold-free dictation: tap to record, tap to stop, text arrives via Whisper. */
export function VoiceButton({
  onText,
  dark = false,
  label = "Speak",
}: {
  onText: (text: string) => void;
  dark?: boolean;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "rec" | "busy" | "err">("idle");
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const r = new MediaRecorder(stream, { mimeType: mime });
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState("busy");
        try {
          const blob = new Blob(chunks.current, { type: mime });
          const form = new FormData();
          form.append("audio", blob, mime === "audio/webm" ? "note.webm" : "note.mp4");
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          const json = await res.json();
          if (json.text) onText(json.text);
          setState(json.text ? "idle" : "err");
        } catch {
          setState("err");
        }
      };
      r.start();
      rec.current = r;
      setState("rec");
    } catch {
      setState("err");
    }
  };

  const stop = () => rec.current?.state === "recording" && rec.current.stop();

  const base = dark
    ? "border-white/20 text-paper hover:bg-white/10"
    : "border-line bg-card text-ink-2 hover:text-ink hover:border-ink-3";
  return (
    <button
      type="button"
      onClick={state === "rec" ? stop : start}
      disabled={state === "busy"}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition ${base} ${
        state === "rec" ? "!border-rose !text-rose" : ""
      }`}
      aria-label={state === "rec" ? "Stop recording" : label}
    >
      {state === "busy" ? <Spinner /> : <Icon name={state === "rec" ? "stop" : "mic"} size={16} className={state === "rec" ? "pulse-soft" : ""} />}
      {state === "rec" ? "Listening… tap to finish" : state === "busy" ? "Writing it down" : state === "err" ? "Mic unavailable, type instead" : label}
    </button>
  );
}
