import { lazy, Suspense, useMemo, useState } from "react";
import { BarList } from "@/components/BarList";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivitySection } from "@/components/stats/ActivitySection";
import { CriticsSection } from "@/components/stats/CriticsSection";
import { DrillDrawer } from "@/components/stats/DrillDrawer";
import { GenreDuelSection } from "@/components/stats/GenreDuelSection";
import { GenresSection } from "@/components/stats/GenresSection";
import { InsightsRow } from "@/components/stats/InsightsRow";
import { OverviewCards } from "@/components/stats/OverviewCards";
import { PredictionsSection } from "@/components/stats/PredictionsSection";
import { QueueSection } from "@/components/stats/QueueSection";
import { RatingHabitsSection } from "@/components/stats/RatingHabitsSection";
import { StatsFilters } from "@/components/stats/StatsFilters";
import { TasteDepthSection } from "@/components/stats/TasteDepthSection";
import { TasteMatchSection } from "@/components/stats/TasteMatchSection";
import { TasteShapeSection } from "@/components/stats/TasteShapeSection";
import { TrendSection, type TrendMetric } from "@/components/stats/TrendSection";
import { useStatsData } from "@/hooks/useStatsData";
import { useTitleEnrichment } from "@/hooks/useTitleEnrichment";
import { useStore } from "@/lib/store";

const ReviewView = lazy(() =>
  import("@/views/ReviewView").then((module) => ({ default: module.ReviewView })),
);

export function StatsView() {
  const { entries, people, nameFor } = useStore();
  const [scopeId, setScopeId] = useState("together");
  const [yearFilter, setYearFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "movie" | "tv">("all");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("count");
  const [drillGenre, setDrillGenre] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const stats = useStatsData({ scopeId, yearFilter, typeFilter });
  const enrichment = useTitleEnrichment();
  const reviewYear = yearFilter === "all" ? String(new Date().getFullYear()) : yearFilter;
  const drillEntries = useMemo(
    () =>
      drillGenre ? stats.filtered.filter((entry) => entry.title.genres.includes(drillGenre)) : [],
    [drillGenre, stats.filtered],
  );

  if (reviewOpen) {
    return (
      <Suspense
        fallback={
          <div className="flex flex-col gap-3">
            <Skeleton className="h-12 w-32" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        }
      >
        <ReviewView year={reviewYear} onClose={() => setReviewOpen(false)} />
      </Suspense>
    );
  }

  if (!entries.length) {
    return (
      <div className="flex flex-col gap-[18px]">
        <header>
          <h1 className="text-[26px] font-bold tracking-tight">Stats</h1>
        </header>
        <p className="text-muted text-[13px]">
          Log a few watches and the analytics will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <header className="flex items-baseline justify-between gap-2">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Stats</h1>
          <p className="text-muted mt-1 text-sm">Joint watches and solo habits, kept apart.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setReviewOpen(true)}>
          {reviewYear} in Review
        </Button>
      </header>

      <InsightsRow insights={stats.insights} />

      <StatsFilters
        years={stats.years}
        yearFilter={yearFilter}
        onYear={setYearFilter}
        typeFilter={typeFilter}
        onType={setTypeFilter}
        scopeId={scopeId}
        onScope={setScopeId}
        jointCount={stats.joint.length}
      />

      {stats.pair && stats.compat && stats.compat.sharedCount > 0 ? (
        <TasteMatchSection compat={stats.compat} gaps={stats.gaps} pair={stats.pair} />
      ) : null}

      <PredictionsSection accuracies={stats.accuracies} />

      {stats.scoped.length ? (
        <>
          <OverviewCards
            movies={stats.movies}
            seasons={stats.seasons}
            minutes={stats.minutes}
            avg={stats.overall.avg}
          />

          <ActivitySection
            entries={stats.scoped}
            streaks={stats.streaks}
            weekdays={stats.weekdays}
          />

          <RatingHabitsSection personHistory={stats.personHistory} note={stats.habitNote} />

          <QueueSection queue={stats.queue} oldestName={stats.queueOldest?.name ?? null} />

          {stats.pair && stats.duels.length ? (
            <GenreDuelSection
              duels={stats.duels}
              duelMax={stats.duelMax}
              pairNames={[stats.pair.a.name, stats.pair.b.name]}
              onDrill={setDrillGenre}
            />
          ) : null}

          <GenresSection genres={stats.genres} />

          {stats.radarReady ? (
            <TasteShapeSection
              data={stats.radarData}
              personIds={people.map((person) => person.id)}
            />
          ) : null}

          <TasteDepthSection
            languages={stats.languages}
            rewatches={stats.rewatches}
            eraStats={stats.eraStats}
            runtimeData={stats.runtimeData}
            missingCount={enrichment.missingCount}
            enriching={enrichment.enriching}
            progress={enrichment.progress}
            onEnrich={() => void enrichment.enrich()}
          />

          <section className="flex flex-col gap-2.5">
            <h2 className="text-[17px] font-semibold">Favourite actors</h2>
            <BarList rows={stats.actors} />
          </section>

          <section className="flex flex-col gap-2.5">
            <h2 className="text-[17px] font-semibold">Favourite directors</h2>
            <BarList rows={stats.directors} />
          </section>

          <CriticsSection critics={stats.critics} outliers={stats.outliers} />

          <TrendSection
            trend={stats.trend}
            compareData={stats.compareData}
            metric={trendMetric}
            onMetric={setTrendMetric}
            yearFilter={yearFilter}
          />

          <section className="flex flex-col gap-2.5">
            <h2 className="text-[17px] font-semibold">By decade</h2>
            <BarList
              rows={stats.decades.map((row) => ({ name: row.decade, count: row.count, avg: null }))}
            />
          </section>
        </>
      ) : (
        <p className="text-muted text-[13px]">
          {scopeId === "together"
            ? 'No joint watches yet — log one with "Together" selected.'
            : `No solo watches logged for ${nameFor(scopeId)} yet.`}
        </p>
      )}

      {drillGenre ? (
        <DrillDrawer
          genre={drillGenre}
          entries={drillEntries}
          onClose={() => setDrillGenre(null)}
        />
      ) : null}
    </div>
  );
}
