import { adapt, type AdaptInput } from "@/lib/adapt";

export const maxDuration = 30;

export async function POST(req: Request) {
  const body = (await req.json()) as AdaptInput;
  if (!body?.reaction?.entity?.id || !body.person?.birthYear || !body.window) {
    return Response.json({ error: "reaction, person and window are required" }, { status: 400 });
  }
  try {
    const out = await adapt({
      ...body,
      seeds: (body.seeds ?? []).slice(0, 12),
      sparks: (body.sparks ?? []).slice(-6),
      avoidIds: (body.avoidIds ?? []).slice(0, 60),
      avoidTags: (body.avoidTags ?? []).slice(0, 12),
      seen: (body.seen ?? []).slice(0, 80),
      calmPool: (body.calmPool ?? []).slice(0, 20),
    });
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
