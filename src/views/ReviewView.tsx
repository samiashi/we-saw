import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, ImageDown } from "lucide-react";
import confetti from "canvas-confetti";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { BarList } from "@/components/BarList";
import { Poster } from "@/components/Poster";
import { ScoreChip } from "@/components/ScoreChip";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import {
  compatibility,
  creditStats,
  criticComparison,
  divergences,
  formatMinutes,
  genreStats,
  jointEntries,
  makeScorer,
  monthsForYear,
  scoreStats,
  seasonLabel,
  soloEntries,
  totalMinutes,
  yearEntries,
} from "@/lib/analytics";
import { useStore } from "@/lib/store";
import { posterUrl } from "@/lib/api";
import { renderRecapImage } from "@/lib/recapImage";

const TOOLTIP_STYLE = {
  background: "var(--color-surface-2)",
  border: "1px solid var(--color-line)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--color-ink)",
};

export function ReviewView({ year, onClose }: { year: string; onClose: () => void }) {
  const { entries, people, nameFor } = useStore();
  const [message, setMessage] = useState("");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    confetti({
      particleCount: 90,
      spread: 75,
      origin: { y: 0.2 },
      colors: ["#e8b64c", "#e0685c", "#57c785", "#f6efdd"],
    });
  }, [year]);

  const yearList = useMemo(() => yearEntries(entries, year), [entries, year]);
  const joint = useMemo(() => jointEntries(yearList), [yearList]);
  const scorer = makeScorer();
  const top = useMemo(
    () =>
      yearList
        .filter((entry) => entry.combined != null)
        .sort((a, b) => (b.combined ?? 0) - (a.combined ?? 0))
        .slice(0, 5),
    [yearList],
  );
  const genres = genreStats(yearList, scorer, 5);
  const actors = creditStats(yearList, "cast", scorer, 3);
  const directors = creditStats(yearList, "directors", scorer, 3);
  const months = monthsForYear(yearList, year);
  const hotMonth = [...months].sort((a, b) => b.count - a.count)[0];
  const minutes = totalMinutes(yearList);
  const overall = scoreStats(yearList, scorer);
  const movies = yearList.filter((entry) => entry.title.type === "movie").length;
  const seasons = yearList.length - movies;
  const soloCounts = people.map((person) => ({
    person,
    count: soloEntries(yearList, person.id).length,
  }));
  const pair = people.length >= 2 ? { a: people[0], b: people[1] } : null;
  const compat = pair ? compatibility(joint, pair.a.id, pair.b.id) : null;
  const gaps = pair ? divergences(joint, pair.a.id, pair.b.id) : [];
  const critics = criticComparison(yearList, scorer);

  function recapText(): string {
    const lines = [
      `Our ${year} in We Saw`,
      `${movies} movies + ${seasons} TV seasons · ${formatMinutes(minutes)} · avg ${overall.avg ?? "—"}`,
    ];
    if (top.length) {
      lines.push(
        `Top: ${top.map((entry) => `${entry.title.name} ${seasonLabel(entry)} (${entry.combined})`.trim()).join(", ")}`,
      );
    }
    if (genres.length) lines.push(`Genres: ${genres.map((row) => row.name).join(", ")}`);
    if (compat && compat.sharedCount) {
      lines.push(
        `Taste match: avg gap ${compat.avgGap}, ${compat.closeShare}% within 2 points (${compat.sharedCount} joint ratings)`,
      );
    }
    if (gaps.length)
      lines.push(
        `Most divisive: ${gaps[0].entry.title.name} (${gaps[0].scoreA} vs ${gaps[0].scoreB})`,
      );
    if (soloCounts.some((row) => row.count > 0)) {
      lines.push(
        soloCounts.map((row) => `${nameFor(row.person.id)} solo ${row.count}`).join(" · "),
      );
    }
    return lines.join("\n");
  }

  function copyRecap() {
    navigator.clipboard
      .writeText(recapText())
      .then(() => setMessage("Recap copied."))
      .catch(() => setMessage("Copy failed — select manually."));
    setTimeout(() => setMessage(""), 3000);
  }

  async function shareImage() {
    setSharing(true);
    const blob = await renderRecapImage({
      year,
      movies,
      seasons,
      minutes,
      avg: overall.avg,
      top: top.map((entry) => ({
        name: entry.title.name,
        label: seasonLabel(entry),
        score: entry.combined,
        posterUrl: posterUrl(entry.title, "w342"),
      })),
      genres: genres.map((row) => row.name),
      tasteLine:
        compat && compat.sharedCount
          ? `Taste match: gap ${compat.avgGap} · ${compat.closeShare}% within 2 points`
          : null,
    });
    setSharing(false);

    if (!blob) {
      setMessage("Could not build the image.");
      return;
    }

    const file = new File([blob], `we-saw-${year}.png`, { type: "image/png" });
    const shareData = { files: [file], title: `Our ${year} in We Saw` };

    if (navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch {
        setMessage("Share cancelled.");
      }
      return;
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `we-saw-${year}.png`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Image saved.");
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft size={16} /> Back
          </Button>
          <Button variant="ghost" size="sm" onClick={copyRecap}>
            <Copy size={16} /> Copy recap
          </Button>
        </div>
        <h1 className="text-accent text-[44px] leading-none font-bold tracking-tight">{year}</h1>
        <p className="text-muted text-sm">The year in review.</p>
      </header>

      {message ? (
        <span role="status" className="text-good text-[13px]">
          {message}
        </span>
      ) : null}

      {!yearList.length ? (
        <p className="text-muted text-[13px]">Nothing logged in {year} yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
            <StatCard value={movies} label="Movies" />
            <StatCard value={seasons} label="TV seasons" />
            <StatCard value={minutes} label="Watch time" format={formatMinutes} />
            <StatCard value={overall.avg} label="Avg rating" format={(value) => value.toFixed(1)} />
          </div>

          {hotMonth && hotMonth.count > 0 ? (
            <p className="text-muted text-[13px]">
              {hotMonth.label} was your biggest month with {hotMonth.count}{" "}
              {hotMonth.count === 1 ? "watch" : "watches"}.
            </p>
          ) : null}

          {top.length ? (
            <section className="flex flex-col gap-2.5">
              <h2 className="text-[17px] font-semibold">Top 5 of the year</h2>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
                {top.map((entry) => (
                  <div
                    key={entry.watch.id}
                    className="flex flex-col items-center gap-1.5 text-center"
                  >
                    <Poster title={entry.title} size="w200" className="w-full" />
                    <span className="text-xs leading-snug">
                      {entry.title.name}
                      {seasonLabel(entry) ? ` ${seasonLabel(entry)}` : ""}
                    </span>
                    <ScoreChip score={entry.combined} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="flex flex-col gap-2.5">
            <h2 className="text-[17px] font-semibold">Activity by month</h2>
            <div className="h-[160px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months}>
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "var(--color-muted)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--color-accent)"
                    radius={[4, 4, 0, 0]}
                    animationDuration={450}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: "var(--color-surface-2)" }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <h2 className="text-[17px] font-semibold">Top genres</h2>
            <BarList rows={genres} />
          </section>

          {actors.length || directors.length ? (
            <section className="flex flex-col gap-2.5">
              <h2 className="text-[17px] font-semibold">Faces of the year</h2>
              <div className="border-line bg-surface flex flex-col gap-2 rounded-2xl border p-3.5">
                {directors.length ? (
                  <div className="flex justify-between gap-3 text-[13.5px]">
                    <span className="truncate">Directors</span>
                    <span className="text-muted">
                      {directors.map((row) => row.name).join(", ")}
                    </span>
                  </div>
                ) : null}
                {actors.length ? (
                  <div className="flex justify-between gap-3 text-[13.5px]">
                    <span className="truncate">Actors</span>
                    <span className="text-muted">{actors.map((row) => row.name).join(", ")}</span>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {pair && compat && compat.sharedCount > 0 ? (
            <section className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-[17px] font-semibold">Taste match</h2>
                <span className="text-muted text-[13px]">On joint watches</span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
                <StatCard
                  value={compat.avgGap}
                  label="Avg gap"
                  format={(value) => value.toFixed(1)}
                />
                <StatCard
                  value={compat.closeShare}
                  label="Within 2 points"
                  format={(value) => `${Math.round(value)}%`}
                />
                <StatCard value={compat.sharedCount} label="Joint ratings" />
              </div>
              {gaps.length ? (
                <div className="border-line bg-surface flex flex-col gap-2 rounded-2xl border p-3.5">
                  <span className="text-muted text-xs tracking-[0.07em] uppercase">The split</span>
                  <div className="flex justify-between gap-3 text-[13.5px]">
                    <span className="truncate">{gaps[0].entry.title.name}</span>
                    <span className="text-muted">
                      {nameFor(pair.a.id)} {gaps[0].scoreA} · {nameFor(pair.b.id)} {gaps[0].scoreB}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 text-[13.5px]">
                    <span className="truncate">{gaps[gaps.length - 1].entry.title.name}</span>
                    <span className="text-muted">
                      {gaps[gaps.length - 1].scoreA} & {gaps[gaps.length - 1].scoreB}
                    </span>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="flex flex-col gap-2.5">
            <h2 className="text-[17px] font-semibold">Solo vs together</h2>
            <div className="flex flex-wrap gap-2">
              <div className="border-line bg-surface flex flex-col gap-0.5 rounded-xl border px-3.5 py-2.5">
                <strong className="text-sm">Together</strong>
                <span className="text-muted text-[13px]">{joint.length} joint watches</span>
              </div>
              {soloCounts.map((row) => (
                <div
                  key={row.person.id}
                  className="border-line bg-surface flex flex-col gap-0.5 rounded-xl border px-3.5 py-2.5"
                >
                  <strong className="text-sm">{nameFor(row.person.id)}</strong>
                  <span className="text-muted text-[13px]">{row.count} solo</span>
                </div>
              ))}
            </div>
          </section>

          {critics.length ? (
            <section className="flex flex-col gap-2.5">
              <h2 className="text-[17px] font-semibold">You vs critics</h2>
              <div className="border-line bg-surface flex flex-col gap-2 rounded-2xl border p-3.5">
                {critics.map((row) => (
                  <div key={row.source} className="flex justify-between gap-3 text-[13.5px]">
                    <span className="truncate">{row.source}</span>
                    <span className="text-muted whitespace-nowrap">
                      You {row.userAvg} · Critics {row.criticAvg} ·{" "}
                      <span className={row.delta >= 0 ? "text-good" : "text-bad"}>
                        {row.delta >= 0 ? "+" : ""}
                        {row.delta}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void shareImage()} disabled={sharing}>
              <ImageDown size={16} /> {sharing ? "Building…" : "Share image"}
            </Button>
            <Button variant="ghost" onClick={copyRecap}>
              Copy recap text
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Back to stats
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
