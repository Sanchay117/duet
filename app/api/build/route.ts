import { buildMemoryMap, type BuildInput } from "@/lib/build";
import type { BuildEvent } from "@/lib/types";

export const maxDuration = 60;

function familyOf(f: BuildInput["family"] | undefined): BuildInput["family"] {
  const loves = String(f?.loves ?? "").trim().slice(0, 400);
  if (!loves) return undefined;
  const year = Number(f?.birthYear);
  const now = new Date().getFullYear();
  return { loves, birthYear: Number.isInteger(year) && year > 1900 && year <= now - 5 ? year : undefined };
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<BuildInput>;
  const birthYear = Number(body.birthYear);
  if (!body.id || !Number.isFinite(birthYear) || birthYear < 1900 || birthYear > new Date().getFullYear() - 12 || !body.hometown) {
    return Response.json({ error: "id, birthYear and hometown are required" }, { status: 400 });
  }
  const input: BuildInput = {
    id: String(body.id),
    birthYear,
    hometown: String(body.hometown).slice(0, 120),
    about: String(body.about ?? "").slice(0, 2000),
    language: body.language ? String(body.language).slice(0, 40) : undefined,
    pronoun: body.pronoun,
    family: familyOf(body.family),
    sparks: Array.isArray(body.sparks)
      ? body.sparks.slice(0, 6).map((s) => ({ name: String(s.name).slice(0, 80), kind: s.kind }))
      : undefined,
    avoidIds: Array.isArray(body.avoidIds) ? body.avoidIds.slice(0, 60).map(String) : undefined,
  };

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: BuildEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        await buildMemoryMap(input, emit);
      } catch (e) {
        emit({ type: "error", message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
