import { useState, useEffect, useCallback, useRef, type MouseEvent } from 'react';
import type { StrategyData, FrontendStrategy } from '../api';

/* ─── Types ─── */

interface TopicInfo {
  name: string;
  summary: string;
}

interface StrategyPageProps {
  companyName: string;
  topic: TopicInfo;
  strategyData: StrategyData | null;
  isLoading: boolean;
  searchError: string | null;
  onBack: () => void;
  onViewDrafts: (strategyIndex: number) => void;
  onSeeWhy: () => void;
  onViewInvoice: () => void;
}

/* ─── Agent Timeline Steps ─── */

const STRATEGY_AGENT_STEPS = [
  { label: 'Analyzing financial exposure', detail: 'Estimating reach and value at risk' },
  { label: 'Scoring risk metrics', detail: 'Calculating churn probability per article' },
  { label: 'Searching historical precedents', detail: 'Querying documented corporate crises' },
  { label: 'Evaluating past strategies', detail: 'Scoring relevance of historical responses' },
  { label: 'Generating crisis strategies', detail: 'Building 3 response approaches with ROI' },
  { label: 'Compiling strategy report', detail: 'Final recommendations ready' },
];

/* ─── Strategy color mapping ─── */

function getStrategyColors(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('offensive')) {
    return {
      color: '#ef4444',
      dotColor: 'bg-red-400',
      borderHover: 'rgba(239,68,68,0.3)',
      glow: 'rgba(239,68,68,0.08)',
      bgLight: 'rgba(239,68,68,0.06)',
    };
  }
  if (lower.includes('diplomate') || lower.includes('diplomat')) {
    return {
      color: '#22c55e',
      dotColor: 'bg-emerald-400',
      borderHover: 'rgba(34,197,94,0.3)',
      glow: 'rgba(34,197,94,0.08)',
      bgLight: 'rgba(34,197,94,0.06)',
    };
  }
  // Silence or fallback
  return {
    color: '#6b7280',
    dotColor: 'bg-gray-400',
    borderHover: 'rgba(107,114,128,0.3)',
    glow: 'rgba(107,114,128,0.08)',
    bgLight: 'rgba(107,114,128,0.06)',
  };
}

function getAlertColors(level: string) {
  switch (level.toUpperCase()) {
    case 'CRITICAL':
      return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200/60', dot: 'bg-red-400' };
    case 'MEDIUM':
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200/60', dot: 'bg-amber-400' };
    case 'SOFT':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200/60', dot: 'bg-blue-400' };
    default:
      return { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200/60', dot: 'bg-gray-400' };
  }
}

function formatCost(eur: number): string {
  if (eur >= 1000) return `\u20AC${(eur / 1000).toFixed(eur % 1000 === 0 ? 0 : 1)}k`;
  return `\u20AC${eur.toLocaleString()}`;
}

/* ─── Tilt Card ─── */

const TILT_MAX = 10;

function StrategyTiltCard({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, active: false });

  const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = cardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      setTilt({
        rx: (y - 0.5) * -TILT_MAX,
        ry: (x - 0.5) * TILT_MAX,
        active: true,
      });
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setTilt({ rx: 0, ry: 0, active: false });
  }, []);

  const dynamicTransform = tilt.active
    ? `perspective(800px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(1.02)`
    : 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)';

  return (
    <div
      ref={cardRef}
      className={className}
      style={style}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="w-full h-full transition-[transform,box-shadow] duration-300 ease-out"
        style={{ transform: dynamicTransform }}
      >
        {children}
      </div>
    </div>
  );
}

/* ─── Strategy Card ─── */

function StrategyCard({
  strategy,
  index,
  isRecommended,
  visible,
  onViewDrafts,
}: {
  strategy: FrontendStrategy;
  index: number;
  isRecommended: boolean;
  visible: boolean;
  onViewDrafts: (index: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const colors = getStrategyColors(strategy.name);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${index * 100}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${index * 100}ms`,
      }}
    >
      <StrategyTiltCard>
        <div
          className="relative rounded-2xl border p-5 flex flex-col cursor-default transition-all duration-300"
          style={{
            backgroundColor: hovered ? '#ffffff' : '#fafbfd',
            borderColor: hovered ? colors.borderHover : '#e8eaf0',
            boxShadow: hovered
              ? `0 16px 48px ${colors.glow}, 0 0 0 1px ${colors.borderHover}, 0 4px 20px rgba(0,0,0,0.04)`
              : '0 2px 16px rgba(0,0,0,0.04)',
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <span
              className={`w-3.5 h-3.5 rounded-full ${colors.dotColor} shrink-0`}
              style={{ boxShadow: `0 0 8px ${colors.color}60` }}
            />
            <h3 className="font-display text-xl text-charcoal tracking-tight">
              {strategy.name}
            </h3>
            {isRecommended && (
              <span className="flex items-center gap-1 text-[10px] font-body font-semibold text-amber-600 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                Recommended
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-[12px] font-body text-storm leading-relaxed mb-3 line-clamp-3">
            {strategy.description}
          </p>

          {/* Tone + Metrics row */}
          <div className="flex items-center gap-3 mb-3">
            <span
              className="text-[11px] font-body font-medium px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: colors.bgLight, color: colors.color }}
            >
              {strategy.tone}
            </span>
            <span className="text-[12px] font-display text-charcoal">
              {formatCost(strategy.estimatedCostEur)}
            </span>
            <span className="text-[12px] font-display" style={{ color: colors.color }}>
              ROI {strategy.roiScore}/10
            </span>
          </div>

          <div className="w-full h-px bg-mist mb-3" />

          {/* Key Actions (max 3) */}
          <ul className="space-y-1 mb-3">
            {strategy.keyActions.slice(0, 3).map((action, i) => (
              <li key={i} className="flex items-start gap-2">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colors.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 shrink-0"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                <span className="text-[11px] font-body text-storm leading-snug line-clamp-1">
                  {action}
                </span>
              </li>
            ))}
            {strategy.keyActions.length > 3 && (
              <li className="text-[10px] font-body text-silver pl-[18px]">
                +{strategy.keyActions.length - 3} more
              </li>
            )}
          </ul>

          {/* Footer: View Drafts */}
          <div className="mt-auto pt-3 border-t border-mist flex items-center justify-between">
            <span className="text-[10px] font-body text-storm/60 line-clamp-1 max-w-[60%]">
              {strategy.estimatedImpact}
            </span>
            <button
              onClick={() => onViewDrafts(index)}
              className="flex items-center gap-1.5 text-[13px] font-body font-medium text-royal
                         hover:text-royal/80 transition-colors group cursor-pointer"
            >
              View Drafts
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </StrategyTiltCard>
    </div>
  );
}

/* ─── Main Page ─── */

export default function StrategyPage({
  companyName,
  topic,
  strategyData,
  isLoading,
  searchError,
  onBack,
  onViewDrafts,
  onSeeWhy,
  onViewInvoice,
}: StrategyPageProps) {
  const [completedSteps, setCompletedSteps] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [visibleStrategies, setVisibleStrategies] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  // Effect 1: Animate steps 0–4 progressively while loading
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (isLoading) {
      const stepsToAnimate = STRATEGY_AGENT_STEPS.length - 1;
      const cumulativeDelays = [3000, 8000, 14000, 21000, 29000];
      for (let i = 0; i < stepsToAnimate; i++) {
        const delay = cumulativeDelays[i] ?? (i + 1) * 7000;
        timers.push(setTimeout(() => setActiveStep(i), delay));
        timers.push(setTimeout(() => setCompletedSteps(i + 1), delay + 600));
      }
    }

    return () => timers.forEach(clearTimeout);
  }, [isLoading]);

  // Effect 2: When data arrives, complete last step and reveal strategies
  useEffect(() => {
    if (!isLoading && strategyData && strategyData.strategies.length > 0) {
      const timers: ReturnType<typeof setTimeout>[] = [];
      const strategies = strategyData.strategies;

      // If data arrived before any steps animated (pre-loaded / demo mode),
      // rapid-fire steps 0–4 first so the timeline doesn't stay gray.
      const preloaded = completedSteps === 0;
      const rapidDelay = 150;
      let baseOffset = 0;

      if (preloaded) {
        const stepsToAnimate = STRATEGY_AGENT_STEPS.length - 1;
        for (let i = 0; i < stepsToAnimate; i++) {
          timers.push(setTimeout(() => setActiveStep(i), i * rapidDelay));
          timers.push(setTimeout(() => setCompletedSteps(i + 1), i * rapidDelay + 100));
        }
        baseOffset = stepsToAnimate * rapidDelay;
      }

      // Complete final agent step
      timers.push(setTimeout(() => setActiveStep(STRATEGY_AGENT_STEPS.length - 1), baseOffset + 100));
      timers.push(setTimeout(() => setCompletedSteps(STRATEGY_AGENT_STEPS.length), baseOffset + 400));

      // Stagger-reveal strategies
      strategies.forEach((_, i) => {
        timers.push(setTimeout(() => setVisibleStrategies(i + 1), baseOffset + 600 + i * 400));
      });

      // Show summary after all strategies revealed
      timers.push(
        setTimeout(
          () => setShowSummary(true),
          baseOffset + 600 + strategies.length * 400 + 300,
        ),
      );

      return () => timers.forEach(clearTimeout);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, strategyData]);

  const strategies = strategyData?.strategies ?? [];
  const alertColors = getAlertColors(strategyData?.alertLevel ?? '');

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
              Back to Articles
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
                  Generating crisis response strategies
                </p>
              </div>

              {/* Timeline */}
              <div className="relative">
                {STRATEGY_AGENT_STEPS.map((step, i) => {
                  const isCompleted = i < completedSteps;
                  const isActive = i === activeStep && i >= completedSteps;

                  return (
                    <div key={i} className="flex gap-3 relative">
                      {i < STRATEGY_AGENT_STEPS.length - 1 && (
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
              {showSummary && strategyData && (
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
                      <p className="text-lg font-display text-royal">
                        {strategyData.alertLevel}
                      </p>
                      <p className="text-[10px] text-storm mt-0.5">
                        Alert Level
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-display text-royal">
                        {strategies.length}
                      </p>
                      <p className="text-[10px] text-storm mt-0.5">
                        Strategies
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
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-royal opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-royal" />
              </span>
              <span className="text-sm font-body text-storm">
                Responding for{' '}
                <span className="font-medium text-charcoal">{companyName}</span>
                {' \u00b7 '}
                <span className="text-royal">{topic.name}</span>
              </span>
            </div>

            {/* Section header */}
            <div className="text-center mb-2 shrink-0">
              <h2 className="font-display text-3xl text-charcoal mb-2">
                Response Strategy
              </h2>
              <p className="text-sm text-storm max-w-lg mx-auto leading-relaxed">
                AI-generated crisis response approaches with cost and ROI analysis
              </p>
            </div>

            {/* Alert level badge */}
            {strategyData && (
              <div
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-8 shrink-0
                           opacity-0 animate-fade-in ${alertColors.bg} ${alertColors.border}`}
                style={{ animationDelay: '400ms' }}
              >
                <span className={`w-2 h-2 rounded-full ${alertColors.dot}`} />
                <span className={`text-[12px] font-body font-semibold ${alertColors.text}`}>
                  {strategyData.alertLevel} Alert
                </span>
                <span className="text-[11px] font-body text-storm/70">
                  — {strategyData.alertReasoning.length > 80
                    ? strategyData.alertReasoning.slice(0, 80) + '...'
                    : strategyData.alertReasoning}
                </span>
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
                  Back to Articles
                </button>
              </div>
            )}

            {/* Empty state */}
            {!isLoading && !searchError && strategyData && strategies.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 text-sm text-storm pt-8">
                <p>No strategies generated. Please try again.</p>
                <button
                  onClick={onBack}
                  className="mt-2 px-5 py-2 rounded-full border border-silver/30 text-storm text-sm hover:text-charcoal transition-colors"
                >
                  Back to Articles
                </button>
              </div>
            )}

            {/* Loading spinner */}
            {visibleStrategies === 0 && !searchError && !(!isLoading && strategyData && strategies.length === 0) && (
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
                <span>Generating crisis strategies...</span>
              </div>
            )}

            {/* Strategy Cards */}
            <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {strategies.map((strategy, i) => (
                <StrategyCard
                  key={strategy.name}
                  strategy={strategy}
                  index={i}
                  isRecommended={strategy.name === strategyData?.recommendedStrategy}
                  visible={i < visibleStrategies}
                  onViewDrafts={onViewDrafts}
                />
              ))}
            </div>

            {/* Decision summary + See Why */}
            {visibleStrategies >= strategies.length && strategies.length > 0 && (
              <>
                {/* Decision summary */}
                <div
                  className="w-full max-w-2xl p-5 rounded-xl bg-white/80 border border-mist
                             shadow-[0_2px_12px_rgba(0,0,0,0.03)] text-center mb-6
                             opacity-0 animate-fade-in-up"
                  style={{ animationDelay: '200ms' }}
                >
                  <p className="text-[10px] font-body font-medium text-royal tracking-[0.15em] uppercase mb-2">
                    Decision Summary
                  </p>
                  <p className="text-[13px] font-body text-storm leading-relaxed">
                    {strategyData?.decisionSummary}
                  </p>
                </div>

                {/* See Why + Cost Breakdown buttons */}
                <div
                  className="flex flex-col sm:flex-row items-center gap-3 opacity-0 animate-fade-in-up"
                  style={{ animationDelay: '400ms' }}
                >
                  <button
                    onClick={onSeeWhy}
                    className="group flex items-center gap-2.5 px-6 py-3 rounded-full
                               border border-silver/30 bg-white/80 backdrop-blur-sm
                               shadow-[0_2px_12px_rgba(0,0,0,0.04)]
                               hover:border-royal/20 hover:shadow-[0_4px_20px_rgba(43,58,143,0.08)]
                               transition-all duration-300"
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
                      className="text-royal/70 group-hover:text-royal transition-colors"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    <span className="text-sm font-body font-medium text-storm group-hover:text-charcoal transition-colors">
                      See Why
                    </span>
                    <span className="text-[11px] text-silver group-hover:text-storm transition-colors">
                      — Historical precedent analysis
                    </span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-silver group-hover:text-royal transition-all duration-200 group-hover:translate-y-0.5"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  <button
                    onClick={onViewInvoice}
                    className="group flex items-center gap-2.5 px-6 py-3 rounded-full
                               border border-silver/30 bg-white/80 backdrop-blur-sm
                               shadow-[0_2px_12px_rgba(0,0,0,0.04)]
                               hover:border-royal/20 hover:shadow-[0_4px_20px_rgba(43,58,143,0.08)]
                               transition-all duration-300"
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
                      className="text-royal/70 group-hover:text-royal transition-colors"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    <span className="text-sm font-body font-medium text-storm group-hover:text-charcoal transition-colors">
                      Cost Breakdown
                    </span>
                    <span className="text-[11px] text-silver group-hover:text-storm transition-colors">
                      — Agency vs AI cost
                    </span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-silver group-hover:text-royal transition-all duration-200 group-hover:translate-x-0.5"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
