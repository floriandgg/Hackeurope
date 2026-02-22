import { useState, useEffect } from 'react';
import type { PrecedentsData, PrecedentCase, PrecedentArticle } from '../api';

/* ─── Types ─── */

interface TopicInfo {
  name: string;
  summary: string;
}

interface PrecedentsPageProps {
  companyName: string;
  topic: TopicInfo;
  precedentsData: PrecedentsData | null;
  isLoading: boolean;
  searchError: string | null;
  onBack: () => void;
}

/* ─── Agent Timeline Steps ─── */

const PRECEDENT_AGENT_STEPS = [
  { label: 'Identifying crisis category', detail: 'Matching crisis type against historical database' },
  { label: 'Scanning precedent database', detail: 'Searching documented corporate crises via Google' },
  { label: 'Ranking by similarity', detail: 'Scoring relevance across industry, scale, and type' },
  { label: 'Analyzing outcomes', detail: 'Evaluating response strategies and recovery timelines' },
  { label: 'Extracting key lessons', detail: 'Cross-referencing successful vs failed approaches' },
  { label: 'Compiling precedent report', detail: 'Most relevant historical cases selected' },
];

/* ─── Article Card ─── */

function ArticleCard({ article }: { article: PrecedentArticle }) {
  const [hovered, setHovered] = useState(false);
  const hasUrl = !!article.url;
  const Tag = hasUrl ? 'a' : 'div';

  return (
    <Tag
      {...(hasUrl ? { href: article.url, target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`w-[195px] h-[160px] rounded-xl border p-4 select-none
                 flex flex-col transition-all duration-300 no-underline ${hasUrl ? 'cursor-pointer' : 'cursor-default'}`}
      style={{
        backgroundColor: '#ffffff',
        borderColor: hovered ? 'rgba(43,58,143,0.15)' : '#e8eaf0',
        boxShadow: hovered
          ? '0 12px 40px rgba(43,58,143,0.12), 0 0 20px rgba(43,58,143,0.05)'
          : '0 4px 20px rgba(0,0,0,0.05)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-medium text-royal bg-periwinkle/25 px-2 py-0.5 rounded-full truncate max-w-[120px]">
          {article.publisher}
        </span>
      </div>

      <h4
        className={`font-display text-[14px] leading-snug mb-auto transition-colors duration-200 line-clamp-3 ${
          hovered ? 'text-royal' : 'text-charcoal'
        }`}
      >
        {article.title}
      </h4>

      <span className="text-[10px] text-silver mt-2 shrink-0">
        {article.date}
      </span>
    </Tag>
  );
}

/* ─── Precedent Case Card ─── */

function PrecedentCaseCard({
  precedent,
  index,
  visible,
  totalCases,
}: {
  precedent: PrecedentCase;
  index: number;
  visible: boolean;
  totalCases: number;
}) {
  const isPositive = precedent.outcome === 'positive';

  return (
    <div
      className="relative flex gap-5"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${index * 80}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${index * 80}ms`,
      }}
    >
      {/* Timeline node */}
      <div className="flex flex-col items-center shrink-0 pt-2">
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{
            backgroundColor: isPositive ? '#22c55e' : '#ef4444',
            boxShadow: isPositive
              ? '0 0 8px rgba(34,197,94,0.35)'
              : '0 0 8px rgba(239,68,68,0.35)',
          }}
        />
        {index < totalCases - 1 && (
          <div
            className="w-px flex-1 min-h-[40px]"
            style={{
              background: 'linear-gradient(to bottom, rgba(43,58,143,0.25), rgba(43,58,143,0.06))',
            }}
          />
        )}
      </div>

      {/* Case card */}
      <div
        className="flex-1 rounded-2xl border p-6 mb-6 transition-all duration-300"
        style={{
          backgroundColor: '#ffffff',
          borderColor: '#e8eaf0',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.borderColor = 'rgba(43,58,143,0.15)';
          el.style.boxShadow = '0 12px 40px rgba(43,58,143,0.1), 0 0 20px rgba(43,58,143,0.04)';
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.borderColor = '#e8eaf0';
          el.style.boxShadow = '0 4px 20px rgba(0,0,0,0.05)';
        }}
      >
        {/* Header: year + company */}
        <div className="flex items-baseline gap-3 mb-1">
          <span className="text-[13px] font-body font-semibold text-royal tabular-nums">
            {precedent.year}
          </span>
          <h3 className="font-display text-xl text-charcoal tracking-tight italic">
            {precedent.company}
          </h3>
        </div>

        {/* Crisis title + type badge */}
        <div className="flex items-center gap-2.5 mb-4">
          <p className="text-[14px] font-body font-medium text-storm">
            {precedent.crisis}
          </p>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-periwinkle/25 text-royal/70 border border-periwinkle/40">
            {precedent.crisisType}
          </span>
        </div>

        {/* Strategy pathway */}
        <div className="flex items-center gap-2 mb-4">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-silver shrink-0"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <span className="text-[12px] font-body text-silver">Strategy:</span>
          <span className="text-[13px] font-body font-medium text-charcoal">
            {precedent.strategy}
          </span>
        </div>

        {/* Outcome badge */}
        <div className="flex items-center gap-3 mb-4">
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full border ${
              isPositive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                : 'bg-red-50 text-red-700 border-red-200/60'
            }`}
          >
            {isPositive ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <path d="M22 4L12 14.01l-3-3" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6M9 9l6 6" />
              </svg>
            )}
            {isPositive ? 'Recovered' : 'Damaged'}
          </span>
          <span className="text-[12px] font-body text-storm">
            {precedent.outcomeLabel}
          </span>
        </div>

        {/* Lesson — blockquote style */}
        <div
          className="pl-4 mb-5 border-l-2"
          style={{ borderColor: isPositive ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)' }}
        >
          <p className="text-[13px] font-body text-storm leading-relaxed italic">
            {precedent.lesson}
          </p>
        </div>

        {/* Article cards */}
        {precedent.articles.length > 0 && (
          <div>
            <span className="text-[10px] font-body font-medium text-silver tracking-[0.12em] uppercase mb-3 block">
              Key Coverage
            </span>
            <div className="flex gap-3 flex-wrap">
              {precedent.articles.map((article, i) => (
                <ArticleCard key={i} article={article} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ─── */

export default function PrecedentsPage({
  companyName,
  topic,
  precedentsData,
  isLoading,
  searchError,
  onBack,
}: PrecedentsPageProps) {
  const [completedSteps, setCompletedSteps] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [visibleCases, setVisibleCases] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  // Effect 1: Animate steps 0–4 progressively while loading
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (isLoading) {
      const stepsToAnimate = PRECEDENT_AGENT_STEPS.length - 1; // hold last step for data arrival
      // Progressive delays matching Agent 2's ~30-60s runtime
      const cumulativeDelays = [1000, 4000, 10000, 18000, 28000];
      for (let i = 0; i < stepsToAnimate; i++) {
        const delay = cumulativeDelays[i] ?? (i + 1) * 6000;
        timers.push(setTimeout(() => setActiveStep(i), delay));
        timers.push(setTimeout(() => setCompletedSteps(i + 1), delay + 600));
      }
    }

    return () => timers.forEach(clearTimeout);
  }, [isLoading]);

  // Effect 2: When data arrives, complete last step and reveal cases
  useEffect(() => {
    if (!isLoading && precedentsData && precedentsData.cases.length > 0) {
      const timers: ReturnType<typeof setTimeout>[] = [];
      const cases = precedentsData.cases;

      // If data arrived before any steps animated (pre-loaded / demo mode),
      // rapid-fire steps 0–4 first so the timeline doesn't stay gray.
      const preloaded = completedSteps === 0;
      const rapidDelay = 150;
      let baseOffset = 0;

      if (preloaded) {
        const stepsToAnimate = PRECEDENT_AGENT_STEPS.length - 1;
        for (let i = 0; i < stepsToAnimate; i++) {
          timers.push(setTimeout(() => setActiveStep(i), i * rapidDelay));
          timers.push(setTimeout(() => setCompletedSteps(i + 1), i * rapidDelay + 100));
        }
        baseOffset = stepsToAnimate * rapidDelay;
      }

      // Complete final agent step
      timers.push(setTimeout(() => setActiveStep(PRECEDENT_AGENT_STEPS.length - 1), baseOffset + 100));
      timers.push(setTimeout(() => setCompletedSteps(PRECEDENT_AGENT_STEPS.length), baseOffset + 400));

      // Stagger-reveal cases (adaptive timing)
      const stagger = cases.length <= 3 ? 600 : cases.length <= 5 ? 500 : 400;
      cases.forEach((_, i) => {
        timers.push(setTimeout(() => setVisibleCases(i + 1), baseOffset + 600 + i * stagger));
      });

      // Show summary after all cases revealed
      timers.push(
        setTimeout(
          () => setShowSummary(true),
          baseOffset + 600 + cases.length * stagger + 300,
        ),
      );

      return () => timers.forEach(clearTimeout);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, precedentsData]);

  const cases = precedentsData?.cases ?? [];
  const positiveCount = cases.filter((c) => c.outcome === 'positive').length;
  const negativeCount = cases.filter((c) => c.outcome === 'negative').length;

  const confidenceLabel = precedentsData?.confidence === 'high'
    ? 'High confidence'
    : precedentsData?.confidence === 'medium'
    ? 'Medium confidence'
    : 'Low confidence';

  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-b from-white via-[#f4f6fb] to-[#eceef4]" />
      <div
        className="fixed top-[-20%] left-1/2 -translate-x-1/2 w-[1000px] h-[800px] rounded-full
                   bg-[radial-gradient(circle,rgba(200,204,232,0.25),transparent_70%)]
                   animate-pulse-glow pointer-events-none"
      />

      {/* Content */}
      <div className="relative z-10 h-screen flex flex-col">
        {/* Nav */}
        <nav
          className="w-full px-6 lg:px-12 py-5 flex items-center justify-between shrink-0
                     opacity-0 animate-fade-in"
          style={{ animationDelay: '100ms' }}
        >
          <div className="flex items-center gap-3">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              className="text-royal shrink-0"
            >
              <path
                d="M12 2l8 4v6c0 5.25-3.5 9.74-8 11-4.5-1.26-8-5.75-8-11V6l8-4z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M12 8v4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="12" cy="16" r="1" fill="currentColor" />
            </svg>
            <span className="font-display text-xl text-charcoal tracking-tight">
              Crisis PR Agent
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm font-body font-medium px-5 py-2 rounded-full
                         border border-silver/30 text-storm
                         hover:text-charcoal hover:border-silver/60
                         transition-all duration-200"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back to Strategy
            </button>
          </div>
        </nav>

        {/* Split View */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Left Panel: Agent Activity */}
          <aside
            className="w-full lg:w-[300px] lg:min-w-[300px] shrink-0
                       border-b lg:border-b-0 lg:border-r border-mist/60
                       opacity-0 animate-fade-in-up overflow-y-auto"
            style={{ animationDelay: '200ms' }}
          >
            <div className="p-6 lg:px-8 lg:py-8">
              <div className="mb-8">
                <h2 className="font-display text-xl text-charcoal mb-1">
                  Agent Activity
                </h2>
                <p className="text-xs text-storm">
                  Analyzing historical precedents
                </p>
              </div>

              {/* Timeline */}
              <div className="relative">
                {PRECEDENT_AGENT_STEPS.map((step, i) => {
                  const isCompleted = i < completedSteps;
                  const isActive = i === activeStep && i >= completedSteps;

                  return (
                    <div key={i} className="flex gap-3 relative">
                      {i < PRECEDENT_AGENT_STEPS.length - 1 && (
                        <div
                          className="absolute left-[11px] top-[24px] w-px h-[calc(100%-10px)] transition-colors duration-500"
                          style={{
                            backgroundColor: isCompleted
                              ? 'rgba(43,58,143,0.25)'
                              : '#e8eaf0',
                          }}
                        />
                      )}

                      <div className="relative shrink-0 w-[24px] h-[24px] flex items-center justify-center">
                        {isCompleted ? (
                          <div className="w-5 h-5 rounded-full bg-royal flex items-center justify-center transition-all duration-300">
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="white"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </div>
                        ) : isActive ? (
                          <div className="w-5 h-5 rounded-full border-2 border-royal bg-royal/5 flex items-center justify-center">
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full rounded-full bg-royal opacity-75 animate-ping" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-royal" />
                            </span>
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-silver/50 bg-mist/30 transition-all duration-300" />
                        )}
                      </div>

                      <div className="pb-5 min-w-0">
                        <p
                          className={`text-[13px] font-medium transition-colors duration-400 ${
                            isCompleted || isActive
                              ? 'text-charcoal'
                              : 'text-silver'
                          }`}
                        >
                          {step.label}
                        </p>
                        {(isCompleted || isActive) && (
                          <p
                            className="text-[11px] text-storm/70 mt-0.5 opacity-0 animate-fade-in"
                            style={{ animationDelay: '100ms' }}
                          >
                            {step.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary card */}
              {showSummary && (
                <div className="mt-2 p-4 rounded-xl bg-white/80 border border-mist shadow-[0_2px_12px_rgba(0,0,0,0.03)] opacity-0 animate-fade-in-up">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </span>
                    <span className="text-[10px] font-medium text-charcoal tracking-wide uppercase">
                      Analysis Complete
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-2xl font-display text-royal">{confidenceLabel}</p>
                      <p className="text-[10px] text-storm mt-0.5">
                        Source Quality
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-display text-royal">
                        {cases.length}
                      </p>
                      <p className="text-[10px] text-storm mt-0.5">
                        Relevant Matches
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Right Panel: Main Content */}
          <main
            className="flex-1 flex flex-col items-center px-6 lg:px-10 py-8 min-h-0 overflow-y-auto
                       opacity-0 animate-fade-in-up"
            style={{ animationDelay: '300ms' }}
          >
            {/* Context bubble */}
            <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm border border-mist rounded-full px-5 py-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] mb-6 shrink-0">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-royal/70"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span className="text-sm font-body text-storm">
                Historical analysis for{' '}
                <span className="font-medium text-charcoal">{companyName}</span>
                {' · '}
                <span className="text-royal">{topic.name}</span>
              </span>
            </div>

            {/* Section header */}
            <div className="text-center mb-2 shrink-0">
              <h2 className="font-display text-3xl text-charcoal mb-2">
                Historical Precedents
              </h2>
              <p className="text-sm text-storm max-w-lg mx-auto leading-relaxed">
                How companies navigated similar crises — and what the outcomes teach us
              </p>
            </div>

            {/* Error state */}
            {searchError && (
              <div className="flex flex-col items-center justify-center gap-3 text-sm pt-8">
                <p className="text-red-600 font-medium">Something went wrong</p>
                <p className="text-storm">{searchError}</p>
                <button
                  onClick={onBack}
                  className="mt-2 px-5 py-2 rounded-full border border-silver/30 text-storm text-sm hover:text-charcoal transition-colors"
                >
                  Back to Strategy
                </button>
              </div>
            )}

            {/* Empty state (no results, not loading, no error) */}
            {!isLoading && !searchError && precedentsData && cases.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 text-sm text-storm pt-8">
                <p>No historical precedents found for this crisis type.</p>
                <button
                  onClick={onBack}
                  className="mt-2 px-5 py-2 rounded-full border border-silver/30 text-storm text-sm hover:text-charcoal transition-colors"
                >
                  Back to Strategy
                </button>
              </div>
            )}

            {/* Outcome legend (only show when we have data) */}
            {cases.length > 0 && (
              <div
                className="flex items-center justify-center gap-6 mb-8 shrink-0 opacity-0 animate-fade-in"
                style={{ animationDelay: '500ms' }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-[11px] font-body text-storm">
                    Recovered ({positiveCount})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span className="text-[11px] font-body text-storm">
                    Damaged ({negativeCount})
                  </span>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="w-full max-w-2xl">
              {/* Loading spinner */}
              {visibleCases === 0 && !searchError && !(!isLoading && precedentsData && cases.length === 0) && (
                <div className="flex items-center justify-center gap-3 text-sm text-storm pt-8">
                  <svg
                    className="animate-spin w-4 h-4 text-royal"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      className="opacity-20"
                    />
                    <path
                      d="M12 2a10 10 0 0 1 10 10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>Searching precedent database…</span>
                </div>
              )}

              {/* Cases on timeline */}
              {cases.map((precedent, i) => (
                <PrecedentCaseCard
                  key={i}
                  precedent={precedent}
                  index={i}
                  visible={i < visibleCases}
                  totalCases={cases.length}
                />
              ))}

              {/* Key insight after all visible */}
              {visibleCases >= cases.length && cases.length > 0 && (
                <div
                  className="mt-4 mb-8 p-5 rounded-xl bg-white/80 border border-mist
                             shadow-[0_2px_12px_rgba(0,0,0,0.03)] text-center
                             opacity-0 animate-fade-in-up"
                  style={{ animationDelay: '300ms' }}
                >
                  <p className="text-[10px] font-body font-medium text-royal tracking-[0.15em] uppercase mb-2">
                    Key Insight
                  </p>
                  <p className="text-[14px] font-display italic text-charcoal leading-relaxed max-w-md mx-auto">
                    {precedentsData?.globalLesson}
                  </p>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
