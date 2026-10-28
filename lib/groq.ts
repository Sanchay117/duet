// Minimal Groq client (OpenAI-compatible chat completions).
import { createHash } from "node:crypto";

const BASE = "https://api.groq.com/openai/v1";

/** Tried in order; each Groq model has its own rate limit, so a 429 moves to the next. */
const MODELS = (process.env.GROQ_MODELS ?? "openai/gpt-oss-120b,openai/gpt-oss-20b,qwen/qwen3.8-27b")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export interface Msg {
  role: "system" | "user" | "assistant";
  content: string;
}

function key() {
  const k = process.env.GROQ_KEY ?? process.env.GROQ_API_KEY;
  if (!k) throw new Error("GROQ_KEY is not set");
  return k;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Identical requests (the same preset opened by several people) share one answer.
const memo = new Map<string, Promise<unknown>>();

function parseJSON<T>(text: string): T {
  const clean = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  return JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1)) as T;
}

interface Opts {
  maxTokens?: number;
  temperature?: number;
  /** Small extraction jobs start on the quicker model. */
  fast?: boolean;
}

async function complete<T>(messages: Msg[], opts: Opts): Promise<T> {
  let lastErr: unknown;
  const order = opts.fast ? [...MODELS.filter((m) => m.includes("20b")), ...MODELS.filter((m) => !m.includes("20b"))] : MODELS;
  for (const model of order) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${BASE}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key()}`, "content-type": "application/json" },
          body: JSON.stringify({
            model,
            messages,
            temperature: opts.temperature ?? 0.6,
            max_completion_tokens: opts.maxTokens ?? 4000,
            response_format: { type: "json_object" },
            ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
          }),
          signal: AbortSignal.timeout(45_000),
        });
        if (res.status === 429) {
          const wait = Number(res.headers.get("retry-after") ?? "0") * 1000;
          lastErr = new Error(`Groq 429 on ${model}`);
          if (attempt === 0 && wait > 0 && wait <= 4000) {
            await sleep(wait);
            continue;
          }
          break; // next model
        }
        if (!res.ok) throw new Error(`Groq ${res.status} on ${model}: ${(await res.text()).slice(0, 200)}`);
        const json = await res.json();
        return parseJSON<T>(json.choices?.[0]?.message?.content ?? "");
      } catch (e) {
        lastErr = e;
      }
    }
  }
  throw lastErr;
}

/** One JSON-mode completion, parsed, with model fallback and request memoization. */
export function chatJSON<T>(messages: Msg[], opts: Opts = {}): Promise<T> {
  const id = createHash("sha256").update(JSON.stringify([messages, opts])).digest("hex");
  if (!memo.has(id)) {
    const p = complete<T>(messages, opts);
    memo.set(id, p);
    p.catch(() => memo.delete(id));
    if (memo.size > 300) memo.delete(memo.keys().next().value as string);
  }
  return memo.get(id) as Promise<T>;
}

/** Speech to text with Whisper on Groq. */
export async function transcribe(audio: Blob, filename = "note.webm"): Promise<string> {
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "json");
  const res = await fetch(`${BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Whisper ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return (json.text ?? "").trim();
}
