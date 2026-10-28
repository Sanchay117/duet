"use client";
import { useState } from "react";
import type { TraceStep } from "@/lib/types";
import { Icon, Spinner } from "./ui";

const ORDER = ["understand", "resolve", "domain-music", "domain-film", "domain-tv", "domain-stars", "domain-books", "home", "profile", "gentle", "curate"];

export function sortSteps(steps: TraceStep[]) {
  return [...steps].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
}

export function Trace({ steps, live = false }: { steps: TraceStep[]; live?: boolean }) {
  const [showReq, setShowReq] = useState(false);
  const sorted = sortSteps(steps);
  return (
    <div>
      <ol className="space-y-2.5">
        {sorted.map((s) => (
          <li key={s.id} className="flex gap-3 rise">
            <span
              className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                s.status === "run" ? "text-clay" : s.status === "ok" ? "bg-sage/15 text-sage" : "bg-gold/20 text-[#8a6418]"
              }`}
            >
              {s.status === "run" ? <Spinner /> : s.status === "ok" ? <Icon name="check" size={14} /> : <span className="text-xs font-bold">!</span>}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className={`text-sm font-medium ${s.status === "run" ? "text-ink" : "text-ink"}`}>{s.label}</span>
                {s.ms !== undefined && s.ms > 0 && <span className="shrink-0 text-xs tabular-nums text-ink-3">{(s.ms / 1000).toFixed(1)}s</span>}
              </div>
              {s.detail && <p className="mt-0.5 text-sm leading-snug text-ink-2">{s.detail}</p>}
              {showReq && s.request && (
                <code className="mt-1 block overflow-x-auto whitespace-pre rounded-md bg-night px-2 py-1.5 text-[11px] leading-relaxed text-glow/90 scroll-x">
                  {s.request}
                </code>
              )}
            </div>
          </li>
        ))}
        {live && sorted.length === 0 && (
          <li className="flex items-center gap-3 text-sm text-ink-2">
            <Spinner className="text-clay" /> Starting the agent…
          </li>
        )}
      </ol>
      {!live && steps.some((s) => s.request) && (
        <button onClick={() => setShowReq((v) => !v)} className="mt-4 text-xs font-medium text-clay-2 underline-offset-2 hover:underline">
          {showReq ? "Hide" : "Show"} the exact Qloo requests
        </button>
      )}
    </div>
  );
}
