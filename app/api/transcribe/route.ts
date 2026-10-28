import { transcribe } from "@/lib/groq";

export const maxDuration = 30;

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("audio");
  if (!(file instanceof Blob) || file.size === 0) return Response.json({ error: "audio is required" }, { status: 400 });
  if (file.size > 8_000_000) return Response.json({ error: "Recording is too long" }, { status: 413 });
  try {
    const text = await transcribe(file, (file as File).name || "note.webm");
    return Response.json({ text });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
