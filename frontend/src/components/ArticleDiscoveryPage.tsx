import { useState, useEffect, useRef, useCallback } from 'react';
import type { TopicGroup, Article } from '../api';

export type { TopicGroup, Article };

interface ExpandRect {
  top: number;
  left: number;
  width: number;
  height: number;
  fullWidth: number;
  fullHeight: number;
}

type ExpandPhase = 'idle' | 'start' | 'expanded' | 'collapsing';

/* ─── Agent Timeline Steps (cosmetic) ─── */

const AGENT_STEPS = [
  { label: 'Initializing search agents', detail: 'Deploying specialized crawlers' },
  { label: 'Scanning news databases', detail: 'Querying Reuters, Bloomberg, AP, and more' },
  { label: 'Analyzing sentiment patterns', detail: 'NLP processing across candidate articles' },
  { label: 'Cross-referencing sources', detail: 'Validating claims across independent outlets' },
  { label: 'Evaluating criticality scores', detail: 'Weighted scoring by reach, severity, and recency' },
  { label: 'Compiling final results', detail: 'Most critical articles selected' },
];

/* ─── Helpers ─── */

function getCriticalityStyle(score: number) {
  if (score >= 8)
    return { badge: 'bg-red-50 text-red-700 border border-red-200/60' };
  if (score >= 5)
    return { badge: 'bg-amber-50 text-amber-700 border border-amber-200/60' };
  return { badge: 'bg-mist text-steel border border-silver/30' };
}

/* ─── Stacking Constants ─── */

const TOPIC_OVERLAP = 30;
const TOPIC_HOVER_GAP = 12;

const ARTICLE_OVERLAP = 22;
const ARTICLE_HOVER_GAP = 8;

/* ─── Article Cards Stack ─── */

function ArticleCardsStack({ articles }: { articles: Article[] }) {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const groupHovered = hoveredCard !== null;

  return (
    <div
      className="flex justify-center items-start"
      onMouseLeave={() => setHoveredCard(null)}
    >
      {articles.map((article, i) => {
        const isHovered = hoveredCard === i;
        const critStyle = getCriticalityStyle(article.criticality);

        return (
          <div
            key={i}
            style={{
              marginLeft:
                i > 0
                  ? groupHovered
                    ? ARTICLE_HOVER_GAP
                    : -ARTICLE_OVERLAP
                  : 0,
              transform: `translateY(${isHovered ? -10 : 0}px)`,
              zIndex: isHovered ? 10 : articles.length - i,
              transition: 'all 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseEnter={() => setHoveredCard(i)}
          >
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-[195px] h-[195px] rounded-xl border p-4 cursor-pointer select-none flex flex-col transition-all duration-300 no-underline"
              style={{
                backgroundColor: '#ffffff',
                borderColor: isHovered
                  ? 'rgba(43,58,143,0.15)'
                  : '#e8eaf0',
                boxShadow: isHovered
                  ? '0 12px 40px rgba(43,58,143,0.12), 0 0 20px rgba(43,58,143,0.05)'
                  : '0 4px 20px rgba(0,0,0,0.05)',
              }}
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[10px] font-medium text-royal bg-periwinkle/25 px-2 py-0.5 rounded-full truncate max-w-[105px]">
                  {article.publisher}
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${critStyle.badge}`}
                >
                  {article.criticality}/10
                </span>
              </div>

              <h4
                className={`font-display text-[14px] leading-snug mb-auto transition-colors duration-200 line-clamp-3 ${
                  isHovered ? 'text-royal' : 'text-charcoal'
                }`}
              >
                {article.title}
              </h4>

              <span className="text-[10px] text-silver mt-2 shrink-0">
                {article.date}
              </span>
            </a>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Topic Cards Stack ─── */

function TopicCardsStack({
  topicGroups,
  visibleTopics,
  hidden,
  onSelectTopic,
  cardRefs,
}: {
  topicGroups: TopicGroup[];
  visibleTopics: number;
  hidden: boolean;
  onSelectTopic: (index: number) => void;
  cardRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
}) {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const groupHovered = hoveredCard !== null;

  return (
    <div
      className="flex justify-center items-center w-full py-6"
      style={{
        opacity: hidden ? 0 : 1,
        transform: hidden ? 'scale(0.97)' : 'scale(1)',
        pointerEvents: hidden ? 'none' : 'auto',
        transition: 'opacity 0.35s ease-out, transform 0.35s ease-out',
      }}
      onMouseLeave={() => setHoveredCard(null)}
    >
      {topicGroups.map((topic, i) => {
        const isHovered = hoveredCard === i;
        const visible = i < visibleTopics;
        const urgency = Math.max(...topic.articles.map((a) => a.criticality));
        const urgencyStyle = getCriticalityStyle(urgency);
        const outlets = [...new Set(topic.articles.map((a) => a.publisher))];

        return (
          <div
            key={i}
            className={`flex ${visible ? '' : 'pointer-events-none'}`}
            style={{
              opacity: visible ? 1 : 0,
              transform: visible
                ? `translateY(${isHovered ? -10 : 0}px)`
                : 'translateY(30px)',
              marginLeft:
                i > 0
                  ? groupHovered
                    ? TOPIC_HOVER_GAP
                    : -TOPIC_OVERLAP
                  : 0,
              zIndex: isHovered ? 10 : i === 1 ? 3 : i === 0 ? 2 : 1,
              transition: 'all 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseEnter={() => setHoveredCard(i)}
            onClick={() => visible && onSelectTopic(i)}
          >
            <div
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className="w-[280px] h-[390px] rounded-2xl border px-6 py-7 cursor-pointer select-none
                         flex flex-col items-center justify-center text-center
                         transition-all duration-300"
              style={{
                backgroundColor: '#ffffff',
                borderColor: isHovered
                  ? 'rgba(43,58,143,0.15)'
                  : '#e8eaf0',
                boxShadow: isHovered
                  ? '0 16px 48px rgba(43,58,143,0.14), 0 0 24px rgba(43,58,143,0.06)'
                  : '0 4px 20px rgba(0,0,0,0.05)',
              }}
            >
              {/* Urgency score */}
              <span
                className={`text-[11px] font-semibold px-3 py-1 rounded-full mb-4 ${urgencyStyle.badge}`}
              >
                Urgency {urgency}/10
              </span>

              {/* Title */}
              <h3
                className={`font-display text-2xl mb-2 leading-snug transition-colors duration-200 ${
                  isHovered ? 'text-royal' : 'text-charcoal'
                }`}
              >
                {topic.name}
              </h3>

              {/* Summary */}
              <p className="text-[13px] text-storm leading-relaxed mb-4 px-1">
                {topic.summary}
              </p>

              {/* Article count */}
              <span className="text-[11px] text-silver mb-3">
                {topic.articles.length} articles
              </span>

              {/* Outlet bubbles */}
              <div className="flex flex-wrap gap-1.5 justify-center">
                {outlets.map((outlet) => (
                  <span
                    key={outlet}
                    className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-periwinkle/25 text-royal/70"
                  >
                    {outlet}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main Page ─── */

interface ArticleDiscoveryPageProps {
  companyName: string;
  topicGroups: TopicGroup[];
  isLoading: boolean;
  searchError: string | null;
  onBack: () => void;
  onRespondToTopic: (topic: TopicGroup) => void;
}

export default function ArticleDiscoveryPage({
  companyName,
  topicGroups,
  isLoading,
  searchError,
  onBack,
  onRespondToTopic,
}: ArticleDiscoveryPageProps) {
  const [completedSteps, setCompletedSteps] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [visibleTopics, setVisibleTopics] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<number | null>(null);
  const [expandRect, setExpandRect] = useState<ExpandRect | null>(null);
  const [expandPhase, setExpandPhase] = useState<ExpandPhase>('idle');

  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const contentAreaRef = useRef<HTMLDivElement>(null);

  // Animate agent steps while loading — progressive delays so the timeline
  // doesn't finish long before the API returns (typically 15–40s).
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (isLoading) {
      const stepsToAnimate = AGENT_STEPS.length - 1; // hold the last step for data arrival
      // Progressive delays: 1s, 3.5s, 7.5s, 13s, 20s — later steps feel heavier
      const cumulativeDelays = [1000, 3500, 7500, 13000, 20000];
      for (let i = 0; i < stepsToAnimate; i++) {
        const delay = cumulativeDelays[i] ?? (i + 1) * 4000;
        timers.push(setTimeout(() => setActiveStep(i), delay));
        timers.push(setTimeout(() => setCompletedSteps(i + 1), delay + 600));
      }
    }

    return () => timers.forEach(clearTimeout);
  }, [isLoading]);

  // When data arrives, complete the last step and reveal topics
  useEffect(() => {
    if (!isLoading && topicGroups.length > 0) {
      const timers: ReturnType<typeof setTimeout>[] = [];

      // If data arrived before any steps animated (pre-loaded / demo mode),
      // rapid-fire steps 0–4 first so the timeline doesn't stay gray.
      const preloaded = completedSteps === 0;
      const rapidDelay = 150; // ms per step
      let baseOffset = 0;

      if (preloaded) {
        const stepsToAnimate = AGENT_STEPS.length - 1;
        for (let i = 0; i < stepsToAnimate; i++) {
          timers.push(setTimeout(() => setActiveStep(i), i * rapidDelay));
          timers.push(setTimeout(() => setCompletedSteps(i + 1), i * rapidDelay + 100));
        }
        baseOffset = stepsToAnimate * rapidDelay;
      }

      // Complete final agent step
      timers.push(setTimeout(() => setActiveStep(AGENT_STEPS.length - 1), baseOffset + 100));
      timers.push(setTimeout(() => setCompletedSteps(AGENT_STEPS.length), baseOffset + 400));

      // Reveal topic cards with stagger
      topicGroups.forEach((_, i) => {
        timers.push(setTimeout(() => setVisibleTopics(i + 1), baseOffset + 600 + i * 500));
      });

      // Show summary after all topics revealed
      timers.push(
        setTimeout(
          () => setShowSummary(true),
          baseOffset + 600 + topicGroups.length * 500 + 300,
        ),
      );

      return () => timers.forEach(clearTimeout);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, topicGroups]);

  /* ─ FLIP expansion: measure card → set start → expand ─ */

  const handleSelectTopic = useCallback((index: number) => {
    const cardEl = cardRefs.current[index];
    const containerEl = contentAreaRef.current;
    if (!cardEl || !containerEl) return;

    const cardRect = cardEl.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();

    setExpandRect({
      top: cardRect.top - containerRect.top,
      left: cardRect.left - containerRect.left,
      width: cardRect.width,
      height: cardRect.height,
      fullWidth: containerRect.width,
      fullHeight: containerRect.height,
    });
    setSelectedTopic(index);
    setExpandPhase('start');

    // Double rAF so browser paints at card position before transitioning
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setExpandPhase('expanded');
      });
    });
  }, []);

  const handleCollapse = useCallback(() => {
    setExpandPhase('collapsing');
    setTimeout(() => {
      setSelectedTopic(null);
      setExpandPhase('idle');
      setExpandRect(null);
    }, 560);
  }, []);

  const totalArticles = topicGroups.reduce(
    (sum, g) => sum + g.articles.length,
    0,
  );

  const showTopics = expandPhase === 'idle' || expandPhase === 'collapsing';
  const isExpanded = expandPhase === 'expanded';

  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      {/* ─── Background ─── */}
      <div className="fixed inset-0 bg-gradient-to-b from-white via-[#f4f6fb] to-[#eceef4]" />
      <div
        className="fixed top-[-20%] left-1/2 -translate-x-1/2 w-[1000px] h-[800px] rounded-full
                   bg-[radial-gradient(circle,rgba(200,204,232,0.25),transparent_70%)]
                   animate-pulse-glow pointer-events-none"
      />

      {/* ─── Content ─── */}
      <div className="relative z-10 h-screen flex flex-col">
        {/* ── Nav ── */}
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
              className="text-sm font-body font-medium px-5 py-2 rounded-full
                         border border-silver/30 text-storm
                         hover:text-charcoal hover:border-silver/60
                         transition-all duration-200"
            >
              New Search
            </button>
          </div>
        </nav>

        {/* ── Split View ── */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* ── Left Panel: Agent Activity ── */}
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
                  Scanning for negative press
                </p>
              </div>

              {/* Timeline */}
              <div className="relative">
                {AGENT_STEPS.map((step, i) => {
                  const isCompleted = i < completedSteps;
                  const isActive = i === activeStep && i >= completedSteps;

                  return (
                    <div key={i} className="flex gap-3 relative">
                      {i < AGENT_STEPS.length - 1 && (
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
                      Scan Complete
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-2xl font-display text-royal">{topicGroups.length}</p>
                      <p className="text-[10px] text-storm mt-0.5">
                        Topics Found
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-display text-royal">
                        {totalArticles}
                      </p>
                      <p className="text-[10px] text-storm mt-0.5">
                        Critical Matches
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* ── Right Panel: Main Content ── */}
          <main
            className="flex-1 flex flex-col items-center px-6 lg:px-10 py-8 min-h-0
                       opacity-0 animate-fade-in-up"
            style={{ animationDelay: '300ms' }}
          >
            {/* Search bubble */}
            <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm border border-mist rounded-full px-5 py-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] mb-6 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-royal opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-royal" />
              </span>
              <span className="text-sm font-body text-storm">
                Scanning for{' '}
                <span className="font-medium text-charcoal">
                  {companyName}
                </span>
              </span>
            </div>

            {/* Section header */}
            <div className="text-center mb-4 shrink-0">
              <h2 className="font-display text-3xl text-charcoal mb-2">
                Negative Coverage
              </h2>
              <p className="text-sm text-storm">
                {isLoading
                  ? 'Agents are analyzing articles…'
                  : `${totalArticles} articles across ${topicGroups.length} crisis topics`}
              </p>
            </div>

            {/* ── Content area ── */}
            <div
              ref={contentAreaRef}
              className="relative flex-1 w-full max-w-4xl flex flex-col min-h-0"
            >
              {/* Loading state */}
              {visibleTopics === 0 && selectedTopic === null && (
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
                  <span>Agents are scanning for articles…</span>
                </div>
              )}

              {/* Error state */}
              {searchError && (
                <div className="flex flex-col items-center justify-center gap-3 text-sm pt-8">
                  <p className="text-red-600 font-medium">Something went wrong</p>
                  <p className="text-storm">{searchError}</p>
                  <button
                    onClick={onBack}
                    className="mt-2 px-5 py-2 rounded-full border border-silver/30 text-storm text-sm hover:text-charcoal transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Empty state (no results, not loading) */}
              {!isLoading && !searchError && topicGroups.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 text-sm text-storm pt-8">
                  <p>No negative coverage found for this company.</p>
                  <button
                    onClick={onBack}
                    className="mt-2 px-5 py-2 rounded-full border border-silver/30 text-storm text-sm hover:text-charcoal transition-colors"
                  >
                    Try Another Company
                  </button>
                </div>
              )}

              {/* Topic cards stack */}
              <TopicCardsStack
                topicGroups={topicGroups}
                visibleTopics={visibleTopics}
                hidden={!showTopics}
                onSelectTopic={handleSelectTopic}
                cardRefs={cardRefs}
              />

              {/* ── Expanding card overlay ── */}
              {expandRect && (
                <div
                  className="absolute bg-white rounded-2xl border border-mist overflow-hidden z-20"
                  style={{
                    transition:
                      expandPhase === 'start'
                        ? 'none'
                        : 'top 0.55s cubic-bezier(0.16,1,0.3,1), left 0.55s cubic-bezier(0.16,1,0.3,1), width 0.55s cubic-bezier(0.16,1,0.3,1), height 0.55s cubic-bezier(0.16,1,0.3,1), box-shadow 0.55s ease-out, border-radius 0.4s ease-out',
                    top: isExpanded ? 0 : expandRect.top,
                    left: isExpanded ? 0 : expandRect.left,
                    width: isExpanded ? expandRect.fullWidth : expandRect.width,
                    height: isExpanded
                      ? expandRect.fullHeight
                      : expandRect.height,
                    borderRadius: isExpanded ? 16 : 16,
                    boxShadow: isExpanded
                      ? '0 12px 48px rgba(0,0,0,0.1), 0 2px 12px rgba(0,0,0,0.04)'
                      : '0 4px 20px rgba(0,0,0,0.06)',
                  }}
                >
                  {/* Inner content — fades in after expand, fades out before collapse */}
                  <div
                    className="w-full h-full overflow-y-auto flex flex-col items-center px-6 lg:px-10 py-8"
                    style={{
                      opacity: isExpanded ? 1 : 0,
                      transition: isExpanded
                        ? 'opacity 0.3s ease-out 0.28s'
                        : 'opacity 0.12s ease-out',
                    }}
                  >
                    {selectedTopic !== null && topicGroups[selectedTopic] && (
                      <ExpandedContent
                        topic={topicGroups[selectedTopic]}
                        onBack={handleCollapse}
                        onRespond={onRespondToTopic}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

/* ─── Expanded Card Content ─── */

function ExpandedContent({
  topic,
  onBack,
  onRespond,
}: {
  topic: TopicGroup;
  onBack: () => void;
  onRespond: (topic: TopicGroup) => void;
}) {
  const urgency = Math.max(...topic.articles.map((a) => a.criticality));
  const urgencyStyle = getCriticalityStyle(urgency);

  return (
    <>
      {/* Back button */}
      <button
        onClick={onBack}
        className="self-start flex items-center gap-2 text-sm text-storm
                   hover:text-charcoal transition-colors mb-6"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to topics
      </button>

      {/* Topic header */}
      <div className="w-full max-w-xl text-center mb-8">
        <span
          className={`inline-block text-[11px] font-semibold px-3 py-1 rounded-full mb-4 ${urgencyStyle.badge}`}
        >
          Urgency {urgency}/10
        </span>
        <h2 className="font-display text-3xl text-charcoal mb-2">
          {topic.name}
        </h2>
        <p className="text-sm text-storm leading-relaxed mb-6">
          {topic.summary}
        </p>

        {/* Respond to topic button */}
        <button
          onClick={() => onRespond(topic)}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full
                     bg-royal text-white text-sm font-body font-medium
                     hover:bg-royal/90
                     hover:shadow-[0_4px_20px_rgba(43,58,143,0.25)]
                     active:scale-[0.97]
                     transition-all duration-200"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Respond to Topic
        </button>
      </div>

      {/* Articles section label */}
      <p className="text-xs font-body font-medium text-silver tracking-[0.15em] uppercase mb-6">
        Related Articles
      </p>

      {/* Article cards stack */}
      <ArticleCardsStack articles={topic.articles} />
    </>
  );
}
