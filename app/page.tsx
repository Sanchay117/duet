import Link from "next/link";
import { BumpCurve } from "@/components/BumpCurve";
import { PresetPicker } from "@/components/PresetPicker";
import { Icon, Logo } from "@/components/ui";

const REPO = "https://github.com/Sanchay117/duet";

// Pairs Qloo's taste graph made for the three sample families.
const PAIRS: { yours: string; yoursBorn: string; hers: string; hersBorn: string; line: string; tags: string[] }[] = [
  {
    yours: "Arijit Singh",
    yoursBorn: "b. 1987",
    hers: "Mohammed Rafi",
    hersBorn: "b. 1924",
    line: "Qloo lists Rafi among Arijit Singh's influences.",
    tags: ["Hindi", "Playback singing"],
  },
  {
    yours: "Christian Nodal",
    yoursBorn: "b. 1999",
    hers: "Vicente Fernández",
    hersBorn: "b. 1940",
    line: "Qloo lists Vicente Fernández among Nodal's influences.",
    tags: ["Ranchera", "Mariachi"],
  },
  {
    yours: "La La Land",
    yoursBorn: "2016",
    hers: "Roman Holiday",
    hersBorn: "1953",
    line: "Her favourite film, high on her era's list when Qloo ranks it by your taste.",
    tags: ["Romance", "Nostalgic"],
  },
];

export default function Home() {
  return (
    <main className="grain flex-1">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-5 text-sm text-ink-2">
          <a href="#why" className="hidden sm:inline hover:text-ink">Why a taste graph</a>
          <a href="#how" className="hidden sm:inline hover:text-ink">How it works</a>
          <Link href="/new" className="rounded-full bg-ink px-4 py-2 text-paper hover:bg-clay-2">
            Begin
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-8 lg:grid-cols-[1.05fr_1fr] lg:pt-14">
        <div className="rise">
          <p className="text-xs uppercase tracking-[0.25em] text-clay-2">For families living with dementia</p>
          <h1 className="serif mt-4 text-5xl leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
            Two eras.
            <br />
            One song.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
            Duet rebuilds the world someone lived in between ten and thirty, then uses Qloo&apos;s taste graph to find where
            your taste and theirs meet. A reminiscence session stops being something you run for them and becomes something
            you share.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#meet" className="inline-flex items-center gap-2 rounded-full bg-clay px-6 py-3 text-paper shadow-sm hover:bg-clay-2">
              See it work in one click <Icon name="arrow-right" size={18} />
            </a>
            <Link href="/new" className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-6 py-3 hover:bg-card">
              Start with someone you love
            </Link>
          </div>
          <p className="mt-5 text-sm text-ink-3">Powered by Qloo&apos;s taste graph of 250M+ cultural entities. No account needed.</p>
        </div>

        <figure className="rise rounded-3xl bg-night p-6 text-paper shadow-[0_30px_80px_-40px_rgba(21,17,13,.9)]" style={{ animationDelay: "120ms" }}>
          <p className="text-xs uppercase tracking-[0.25em] text-glow/80">Common ground, found by Qloo</p>
          <ul className="mt-4 divide-y divide-white/10">
            {PAIRS.map((p) => (
              <li key={p.yours} className="py-4 first:pt-1 last:pb-1">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#b9cdb0]">You love</div>
                    <div className="serif truncate text-xl leading-tight">{p.yours}</div>
                    <div className="text-xs text-paper/50">{p.yoursBorn}</div>
                  </div>
                  <Icon name="pair" size={22} className="text-glow" />
                  <div className="min-w-0 text-right">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-glow/80">They love</div>
                    <div className="serif truncate text-xl leading-tight">{p.hers}</div>
                    <div className="text-xs text-paper/50">{p.hersBorn}</div>
                  </div>
                </div>
                <p className="mt-2 text-sm text-paper/75">{p.line}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.tags.map((t) => (
                    <span key={t} className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs text-paper/85">
                      {t}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </figure>
      </section>

      {/* Presets */}
      <section id="meet" className="mx-auto max-w-6xl scroll-mt-8 px-5 pb-20">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="serif text-3xl">Meet a family</h2>
            <p className="mt-1 text-ink-2">Fictional people, real cultural data. Watch the agent build each memory map and find the common ground live.</p>
          </div>
        </div>
        <PresetPicker />
      </section>

      {/* Why Qloo */}
      <section id="why" className="border-y border-line bg-paper-2/60">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="text-xs uppercase tracking-[0.25em] text-clay-2">Why it needs a taste graph</p>
          <h2 className="serif mt-3 max-w-3xl text-4xl leading-tight">
            &ldquo;She loves Mohammed Rafi&rdquo; is not enough. It has to be <em>her</em> Rafi, from <em>her</em> years, and a
            way in for you.
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-line bg-card p-6">
              <div className="flex items-center gap-2 text-sm text-ink-3">
                <Icon name="x" size={16} /> Taste without time
              </div>
              <p className="mt-3 text-ink-2">Fans of Mohammed Rafi also like:</p>
              <ul className="mt-3 space-y-2">
                {[
                  ["Sonu Nigam", "born 1973"],
                  ["Sukhwinder Singh", "born 1968"],
                  ["Shankar Mahadevan", "born 1967"],
                ].map(([n, b]) => (
                  <li key={n} className="flex items-baseline justify-between border-b border-line/70 pb-2">
                    <span className="serif text-lg">{n}</span>
                    <span className="text-sm text-ink-3">{b}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-ink-3">
                Right taste, wrong lifetime. A woman born in 1951 never heard these singers as a girl.
              </p>
            </div>
            <div className="rounded-2xl border border-clay/40 bg-card p-6 shadow-[0_20px_50px_-35px_rgba(180,83,42,.8)]">
              <div className="flex items-center gap-2 text-sm text-clay-2">
                <Icon name="check" size={16} /> Duet, era-locked to 1961–1981, ranked by your taste
              </div>
              <p className="mt-3 text-ink-2">For Kamla, born 1951 in Lucknow, and a grandchild who loves Arijit Singh:</p>
              <ul className="mt-3 space-y-2">
                {[
                  ["Kishore Kumar", "closest to your taste"],
                  ["Guide", "1965 · her favourite, near the top"],
                  ["Gol Maal", "1979 · she was 28"],
                ].map(([n, b]) => (
                  <li key={n} className="flex items-baseline justify-between gap-3 border-b border-line/70 pb-2">
                    <span className="serif text-lg">{n}</span>
                    <span className="text-right text-sm text-clay-2">{b}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-ink-3">
                Qloo&apos;s affinity across music, film, people and places, filtered to the years her memory holds, then ranked by
                what you love.
              </p>
            </div>
          </div>
          <div className="mt-10 grid items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
            <figure className="rounded-3xl border border-line bg-card p-6">
              <BumpCurve />
              <figcaption className="mt-4 text-sm leading-relaxed text-ink-2">
                <span className="serif text-base text-ink">The reminiscence bump.</span> People recall far more from ages 10 to
                30 than from any other time, and those memories are the last to fade.
              </figcaption>
            </figure>
            <div className="grid gap-4 text-sm text-ink-2 sm:grid-cols-2">
              {[
                ["Era-locked", "Release years, career spans and birth dates keep every item inside their bump."],
                ["Both ways", "Qloo ranks their era by your taste and your era by theirs, then pairs your favourites with theirs."],
                ["Hometown", "Qloo place data surfaces the dishes and streets of where they grew up."],
                ["Verified", "Anything the language model suggests is checked against Qloo, or dropped."],
              ].map(([t, d]) => (
                <div key={t} className="rounded-xl border border-line bg-card/70 p-4">
                  <div className="serif text-lg text-ink">{t}</div>
                  <p className="mt-1 leading-relaxed">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-8 px-5 py-20">
        <h2 className="serif text-4xl">How a duet works</h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-4">
          {[
            ["Tell it a little", "Their birth year, hometown and a favourite singer or film. Then a few things you love yourself."],
            ["It finds their era", "The agent reads your notes, checks every guess against Qloo, and searches six domains locked to their years."],
            ["It finds your common ground", "Qloo ranks their era by your taste and yours by theirs, and pairs each of your favourites with one of theirs."],
            ["Sit together", "Ten cards, a few chosen for you both. Tap when they light up or grow quiet, and the next cards change in seconds."],
          ].map(([t, d], i) => (
            <li key={t} className="relative rounded-2xl border border-line bg-card p-5">
              <span className="serif text-4xl text-clay/70">{i + 1}</span>
              <div className="serif mt-2 text-xl">{t}</div>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Care principles */}
      <section className="bg-night text-paper">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="serif text-4xl leading-tight">Built around how reminiscence care is actually done.</h2>
            <p className="mt-4 text-paper/70">
              Duet is a conversation aid for families and care staff, not a medical treatment. It is designed to make a good
              afternoon together more likely.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["Invitations, not tests", "Questions like “Do you remember…?” can cause distress. Every prompt is an open invitation: “Tell me about…”"],
              ["Gentle by default", "War, partition, violence and loss are held back automatically. The trace shows exactly what was screened."],
              ["Their heart language", "Prompts come in the language they grew up speaking, and can be read aloud."],
              ["Private by design", "Names and notes stay in this browser. Qloo only ever sees public cultural signals."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl border border-white/10 bg-night-2 p-5">
                <div className="serif text-xl text-glow">{t}</div>
                <p className="mt-2 text-sm leading-relaxed text-paper/75">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-10 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between">
        <Logo size={18} />
        <p>
          Cultural data from <a className="underline hover:text-ink" href="https://www.qloo.com">Qloo</a>. Language and voice by Groq.{" "}
          <a className="underline hover:text-ink" href={REPO}>
            Open source
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
