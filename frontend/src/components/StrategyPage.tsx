import { useState, useCallback, useRef, type MouseEvent } from 'react';

/* ─── Types ─── */

interface TopicInfo {
  name: string;
  summary: string;
}

interface StrategyPageProps {
  companyName: string;
  topic: TopicInfo;
  onBack: () => void;
  onViewDrafts: (strategyIndex: number) => void;
  onSeeWhy: () => void;
}

/* ─── Strategy Data ─── */

interface Strategy {
  title: string;
  color: string;
  dotColor: string;
  borderHoverColor: string;
  glowColor: string;
  description: string;
  risk: string;
  riskColor: string;
  trustRecovery: string;
  bestFor: string;
  recommended: boolean;
}

const STRATEGIES: Strategy[] = [
  {
    title: 'Own It',
    color: '#22c55e',
    dotColor: 'bg-emerald-400',
    borderHoverColor: 'rgba(34,197,94,0.3)',
    glowColor: 'rgba(34,197,94,0.08)',
    description: 'Full transparency\nApologize now\nAnnounce plan',
    risk: 'Low',
    riskColor: 'text-emerald-600',
    trustRecovery: 'Fast',
    bestFor: 'When facts are already public',
    recommended: true,
  },
  {
    title: 'Reframe',
    color: '#f59e0b',
    dotColor: 'bg-amber-400',
    borderHoverColor: 'rgba(245,158,11,0.3)',
    glowColor: 'rgba(245,158,11,0.08)',
    description: 'Acknowledge + pivot to action\nForward-looking',
    risk: 'Medium',
    riskColor: 'text-amber-600',
    trustRecovery: 'Moderate',
    bestFor: 'When fault is shared/unclear',
    recommended: false,
  },
  {
    title: 'Hold the Line',
    color: '#ef4444',
    dotColor: 'bg-red-400',
    borderHoverColor: 'rgba(239,68,68,0.3)',
    glowColor: 'rgba(239,68,68,0.08)',
    description: 'Minimal public response\nHandle privately',
    risk: 'Very High',
    riskColor: 'text-red-600',
    trustRecovery: 'Unlikely',
    bestFor: 'When legal exposure is extreme',
    recommended: false,
  },
];

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
    ? `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(1.02)`
    : 'rotateX(0deg) rotateY(0deg) scale(1)';

  return (
    <div
      ref={cardRef}
      className={className}
      style={{
        ...style,
        perspective: '800px',
        transformStyle: 'preserve-3d',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="w-full h-full transition-[transform,box-shadow] duration-300 ease-out will-change-transform"
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
  onViewDrafts,
}: {
  strategy: Strategy;
  index: number;
  onViewDrafts: (index: number) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <StrategyTiltCard
      className="opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${400 + index * 150}ms` }}
    >
      <div
        className="relative rounded-2xl border p-7 h-full flex flex-col cursor-default
                   transition-all duration-300"
        style={{
          backgroundColor: hovered ? '#ffffff' : '#fafbfd',
          borderColor: hovered ? strategy.borderHoverColor : '#e8eaf0',
          boxShadow: hovered
            ? `0 16px 48px ${strategy.glowColor}, 0 0 0 1px ${strategy.borderHoverColor}, 0 4px 20px rgba(0,0,0,0.04)`
            : '0 2px 16px rgba(0,0,0,0.04)',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Header with colored dot + title */}
        <div className="flex items-center gap-3 mb-6">
          <span
            className={`w-3.5 h-3.5 rounded-full ${strategy.dotColor} shrink-0`}
            style={{
              boxShadow: `0 0 8px ${strategy.color}60`,
            }}
          />
          <h3 className="font-display text-xl text-charcoal tracking-tight">
            {strategy.title}
          </h3>
        </div>

        {/* Description */}
        <div className="mb-6">
          {strategy.description.split('\n').map((line, i) => (
            <p
              key={i}
              className="text-[14px] font-body text-storm leading-relaxed"
            >
              {line}
            </p>
          ))}
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-mist mb-5" />

        {/* Risk + Trust recovery */}
        <div className="space-y-2 mb-5">
          <div className="flex items-baseline gap-2">
            <span className="text-[12px] font-body font-medium text-silver uppercase tracking-wider">
              Risk:
            </span>
            <span className={`text-[14px] font-body font-semibold ${strategy.riskColor}`}>
              {strategy.risk}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[12px] font-body font-medium text-silver uppercase tracking-wider">
              Trust recovery:
            </span>
            <span className="text-[14px] font-body font-semibold text-charcoal">
              {strategy.trustRecovery}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-mist mb-5" />

        {/* Best for */}
        <div className="mb-auto">
          <span className="text-[12px] font-body font-medium text-silver uppercase tracking-wider">
            Best for:
          </span>
          <p className="text-[14px] font-body text-charcoal mt-1 leading-relaxed">
            {strategy.bestFor}
          </p>
        </div>

        {/* Footer: recommended badge + View Drafts */}
        <div className="mt-6 pt-5 border-t border-mist flex items-center justify-between">
          {strategy.recommended ? (
            <span className="flex items-center gap-1.5 text-[12px] font-body font-semibold text-amber-600">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Recommended
            </span>
          ) : (
            <span />
          )}
          <button
            onClick={() => onViewDrafts(index)}
            className="flex items-center gap-1.5 text-[13px] font-body font-medium text-royal
                       hover:text-royal/80 transition-colors group"
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
  );
}

/* ─── Main Page ─── */

export default function StrategyPage({
  companyName,
  topic,
  onBack,
  onViewDrafts,
  onSeeWhy,
}: StrategyPageProps) {
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
      <div className="relative z-10 min-h-screen flex flex-col">
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

        {/* ── Main content ── */}
        <main className="flex-1 flex flex-col items-center px-6 lg:px-10 py-8">
          {/* Context bubble */}
          <div
            className="flex items-center gap-3 bg-white/80 backdrop-blur-sm border border-mist
                       rounded-full px-5 py-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] mb-6
                       opacity-0 animate-fade-in"
            style={{ animationDelay: '150ms' }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-royal opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-royal" />
            </span>
            <span className="text-sm font-body text-storm">
              Responding for{' '}
              <span className="font-medium text-charcoal">{companyName}</span>
            </span>
          </div>

          {/* Page header */}
          <div
            className="text-center mb-4 opacity-0 animate-fade-in-up"
            style={{ animationDelay: '200ms' }}
          >
            <h2 className="font-display text-3xl text-charcoal mb-2">
              Response Strategy
            </h2>
            <p className="text-sm text-storm max-w-lg mx-auto leading-relaxed">
              Choose a strategy for the{' '}
              <span className="font-medium text-charcoal">{topic.name}</span>{' '}
              crisis. Each approach carries different risk and recovery profiles.
            </p>
          </div>

          {/* Topic context pill */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-periwinkle/25
                       border border-periwinkle/40 mb-10 opacity-0 animate-fade-in-up"
            style={{ animationDelay: '300ms' }}
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
              className="text-royal/70"
            >
              <path d="M12 2l8 4v6c0 5.25-3.5 9.74-8 11-4.5-1.26-8-5.75-8-11V6l8-4z" />
            </svg>
            <span className="text-[12px] font-body font-medium text-royal/80">
              {topic.name}
            </span>
          </div>

          {/* ── Strategy Cards ── */}
          <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {STRATEGIES.map((strategy, i) => (
              <StrategyCard
                key={strategy.title}
                strategy={strategy}
                index={i}
                onViewDrafts={onViewDrafts}
              />
            ))}
          </div>

          {/* ── See Why / Historical Analysis ── */}
          <div
            className="opacity-0 animate-fade-in-up"
            style={{ animationDelay: '900ms' }}
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
          </div>
        </main>
      </div>
    </div>
  );
}
