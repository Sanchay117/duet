"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Icon, Logo } from "@/components/ui";
import { VoiceButton } from "@/components/VoiceButton";
import { newId, store } from "@/lib/store";

function NewPerson() {
  const router = useRouter();
  const me = useSearchParams().get("me") === "1";
  const thisYear = new Date().getFullYear();
  const [name, setName] = useState(me ? "Me" : "");
  const [birthYear, setBirthYear] = useState<string>(me ? "" : "");
  const [hometown, setHometown] = useState("");
  const [about, setAbout] = useState("");
  const [language, setLanguage] = useState("");
  const [pronoun, setPronoun] = useState<"she" | "he" | "they">(me ? "they" : "she");
  const [yourLoves, setYourLoves] = useState("");
  const [yourYear, setYourYear] = useState("");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const by = Number(birthYear);
    if (!by || by < 1915 || by > thisYear - 15) return setError(`Enter a birth year between 1915 and ${thisYear - 15}.`);
    if (hometown.trim().length < 2) return setError("Where did they grow up? A city and country is best.");
    const yy = Number(yourYear);
    if (yourYear && (yy < 1915 || yy > thisYear - 5)) return setError(`Your own birth year should be between 1915 and ${thisYear - 5}, or left blank.`);
    const id = newId();
    store.savePerson({
      id,
      name: name.trim() || "Someone special",
      birthYear: by,
      hometown: hometown.trim(),
      about: about.trim(),
      language: language.trim() || undefined,
      pronoun,
      family: !me && yourLoves.trim() ? { loves: yourLoves.trim(), birthYear: yy || undefined } : undefined,
      createdAt: Date.now(),
    });
    router.push(`/p/${id}`);
  };

  const field = "w-full rounded-xl border border-line bg-card px-4 py-3 text-lg outline-none transition focus:border-clay focus:ring-4 focus:ring-clay/10";
  const bumpFrom = Number(birthYear) ? Number(birthYear) + 10 : undefined;

  return (
    <main className="grain flex-1">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link href="/">
          <Logo />
        </Link>
        <Link href="/" className="text-sm text-ink-3 hover:text-ink">
          Back
        </Link>
      </header>

      <form onSubmit={submit} className="mx-auto max-w-3xl px-5 pb-24 pt-6">
        <h1 className="serif text-4xl leading-tight sm:text-5xl">{me ? "What were you listening to at sixteen?" : "Tell us a little about them."}</h1>
        <p className="mt-3 max-w-xl text-ink-2">
          {me
            ? "Give Duet your birth year and hometown. It will rebuild the world of your teens and twenties."
            : "Partial memories are perfect. Duet fills in the rest from their era and hometown, and checks every guess against Qloo."}
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">{me ? "Your name" : "What do you call them?"}</span>
            <input className={`${field} mt-2`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nani, Grandpa Joe, Mum…" />
            <span className="mt-1.5 block text-xs text-ink-3">Stays on this device. Never sent anywhere.</span>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Year born</span>
            <input
              className={`${field} mt-2`}
              inputMode="numeric"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1948"
              required
            />
            <span className="mt-1.5 block text-xs text-ink-3">
              {bumpFrom ? `Their memory years: ${bumpFrom} to ${Math.min(bumpFrom + 20, thisYear)}` : "We focus on the years they were 10 to 30."}
            </span>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">Where they grew up</span>
            <input className={`${field} mt-2`} value={hometown} onChange={(e) => setHometown(e.target.value)} placeholder="Lucknow, India" required />
          </label>
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{me ? "Anything you loved back then" : "What did they love?"}</span>
              <VoiceButton label="Say it instead" onText={(t) => setAbout((a) => (a ? `${a} ${t}` : t))} />
            </div>
            <textarea
              className={`${field} mt-2 min-h-36 text-base leading-relaxed`}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder={
                me
                  ? "The band on my bedroom wall, the show we watched every Friday…"
                  : "She sang Mohammed Rafi songs while cooking. Her favourite film was Guide. She was a teacher and made the best kheer at Diwali."
              }
            />
            <span className="mt-1.5 block text-xs text-ink-3">Singers, films, shows, work, festivals, food. No need for anyone&apos;s names.</span>
          </div>
          <label className="block">
            <span className="text-sm font-medium">Language they grew up speaking</span>
            <input className={`${field} mt-2`} value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="Optional, e.g. Hindi" />
          </label>
          <fieldset>
            <legend className="text-sm font-medium">Refer to them as</legend>
            <div className="mt-2 flex gap-2">
              {(["she", "he", "they"] as const).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPronoun(p)}
                  className={`flex-1 rounded-xl border px-4 py-3 text-lg transition ${
                    pronoun === p ? "border-clay bg-clay text-paper" : "border-line bg-card hover:border-ink-3"
                  }`}
                  aria-pressed={pronoun === p}
                >
                  {p}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {!me && (
          <fieldset className="mt-10 rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--clay)_45%,transparent)] bg-card/60 p-5 sm:p-6">
            <legend className="px-2 text-xs uppercase tracking-[0.25em] text-clay-2">And you? Optional</legend>
            <p className="text-ink-2">
              Name a few singers, films or shows you love. Duet finds where your taste meets theirs, so the session has something in
              it for both of you.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_11rem]">
              <label className="block">
                <span className="text-sm font-medium">What you love</span>
                <input
                  className={`${field} mt-2`}
                  value={yourLoves}
                  onChange={(e) => setYourLoves(e.target.value)}
                  placeholder="Arijit Singh, Zindagi Na Milegi Dobara"
                  maxLength={400}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Your birth year</span>
                <input
                  className={`${field} mt-2`}
                  inputMode="numeric"
                  value={yourYear}
                  onChange={(e) => setYourYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="2001"
                />
              </label>
            </div>
          </fieldset>
        )}

        {error &&<p className="mt-6 rounded-xl bg-rose/10 px-4 py-3 text-rose">{error}</p>}

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-clay px-7 py-3.5 text-lg text-paper hover:bg-clay-2">
            Build the memory map <Icon name="arrow-right" size={18} />
          </button>
          <span className="flex items-center gap-1.5 text-sm text-ink-3">
            <Icon name="shield" size={16} /> Qloo sees only the year, hometown and cultural names.
          </span>
        </div>
      </form>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <NewPerson />
    </Suspense>
  );
}
