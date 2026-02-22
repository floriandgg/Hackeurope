import { useCallback, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { DEMO_DATA } from '../data/demoData';

interface LandingPageProps {
  onSubmit: (companyName: string, inputRect: DOMRect) => void;
  onDemoClick: (companyKey: string) => void;
}

/* ─── Build demo card data from pre-cached DEMO_DATA ─── */

const DEMO_COMPANIES: {
  companyKey: string;
  title: string;
  topicCount: number;
  alertLevel: string;
  roiMultiplier: number;
}[] = Object.entries(DEMO_DATA).map(([key, data]) => {
  // Find the first topic with a strategy response to get alert level + ROI
  const firstTopic = Object.values(data.topicResponses)[0];
  return {
    companyKey: key,
    title: data.companyName,
    topicCount: data.topicGroups.length,
    alertLevel: firstTopic?.strategyData.alertLevel ?? 'MEDIUM',
    roiMultiplier: firstTopic?.invoiceData?.roiMultiplier ?? 0,
  };
});

const FAN_STYLES: React.CSSProperties[] = [
  { left: '25%', transform: 'translate(-60%, 20px) rotate(-8deg)', zIndex: 1 },
  { left: '50%', transform: 'translate(-50%, 0px)', zIndex: 3 },
  { left: '75%', transform: 'translate(-40%, 20px) rotate(8deg)', zIndex: 2 },
];

const TILT_MAX = 14; // max degrees of rotation
const SCALE_HOVER = 1.04;

function TiltCard({
  children,
  className,
  style,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
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
      const x = (e.clientX - rect.left) / rect.width; // 0..1
      const y = (e.clientY - rect.top) / rect.height; // 0..1
      setTilt({
        rx: (y - 0.5) * -TILT_MAX, // tilt around X axis
        ry: (x - 0.5) * TILT_MAX,  // tilt around Y axis
        active: true,
      });
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setTilt({ rx: 0, ry: 0, active: false });
  }, []);

  const dynamicTransform = tilt.active
    ? `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${SCALE_HOVER})`
    : 'rotateX(0deg) rotateY(0deg) scale(1)';

  return (
    <div
      ref={cardRef}
      className={`${className ?? ''} ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        ...style,
        perspective: '800px',
        transformStyle: 'preserve-3d',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      <div
        className="w-full h-full bg-white rounded-2xl border border-mist p-6
                   shadow-[0_8px_40px_rgba(0,0,0,0.06)]
                   transition-[transform,box-shadow] duration-300 ease-out
                   will-change-transform"
        style={{
          transform: dynamicTransform,
          boxShadow: tilt.active
            ? '0 20px 60px rgba(0,0,0,0.12), 0 8px 24px rgba(43,58,143,0.08)'
            : '0 8px 40px rgba(0,0,0,0.06)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function getAlertColor(level: string) {
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

function DemoCardContent({ company }: { company: (typeof DEMO_COMPANIES)[number] }) {
  const alert = getAlertColor(company.alertLevel);
  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${alert.bg} ${alert.border} ${alert.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${alert.dot}`} />
          {company.alertLevel}
        </span>
        <span className="text-[11px] font-medium text-royal bg-periwinkle/25 px-2.5 py-1 rounded-full">
          {company.topicCount} topics
        </span>
      </div>

      <h3 className="font-display text-2xl text-charcoal mb-5">
        {company.title}
      </h3>

      {company.roiMultiplier > 0 && (
        <>
          <div className="text-5xl font-display text-royal mb-1" style={{ fontFeatureSettings: '"tnum"' }}>
            {company.roiMultiplier.toLocaleString()}
            <span className="text-3xl">&times;</span>
          </div>
          <p className="text-sm text-storm mb-5">ROI vs agency</p>
        </>
      )}

      <div className="pt-4 border-t border-mist flex items-center gap-2 text-royal">
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
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
        <span className="text-xs font-medium">View analysis</span>
      </div>
    </>
  );
}

export default function LandingPage({ onSubmit, onDemoClick }: LandingPageProps) {
  const [url, setUrl] = useState('');
  const formCardRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (url.trim() && formCardRef.current) {
      onSubmit(url.trim(), formCardRef.current.getBoundingClientRect());
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      {/* ─── Background Layers ─── */}
      <div className="fixed inset-0 bg-gradient-to-b from-white via-[#f4f6fb] to-[#eceef4]" />
      <div
        className="fixed top-[-20%] left-1/2 -translate-x-1/2 w-[1000px] h-[800px] rounded-full
                   bg-[radial-gradient(circle,rgba(200,204,232,0.25),transparent_70%)]
                   animate-pulse-glow pointer-events-none"
      />

      {/* ─── 3D Spline: Background Scene Container ───
          Full-viewport layer behind all content.
          Drop a <Spline scene="..." /> or <iframe> here.
          Set pointer-events-auto on the child when active. */}
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        aria-hidden="true"
      >
        {/* 3D Spline model container — background scene */}
      </div>

      {/* ─── Page Content ─── */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* ── Nav ── */}
        <nav
          className="w-full px-6 lg:px-12 py-5 flex items-center justify-between
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

          <div className="flex items-center gap-8">
            <a
              href="#how"
              className="hidden sm:block text-sm font-body text-storm
                         hover:text-charcoal transition-colors"
            >
              How it Works
            </a>
            <button
              className="text-sm font-body font-medium px-5 py-2 rounded-full
                         bg-royal text-white hover:bg-royal/90 transition-all"
            >
              Get Started
            </button>
          </div>
        </nav>

        {/* ── Hero ── */}
        <main className="flex-1 flex flex-col items-center px-6 pt-16 sm:pt-24">
          {/* Status badge */}
          <div
            className="opacity-0 animate-fade-in-up flex items-center gap-2.5
                       px-4 py-1.5 rounded-full border border-silver/40
                       bg-mist/50 mb-8"
            style={{ animationDelay: '200ms' }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-royal opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-royal" />
            </span>
            <span className="text-[11px] font-body font-medium text-storm tracking-[0.18em] uppercase">
              Powered by AI Agents
            </span>
          </div>

          {/* Headline */}
          <h1
            className="opacity-0 animate-fade-in-up text-center font-display
                       text-5xl sm:text-6xl lg:text-7xl text-charcoal
                       leading-[1.08] tracking-tight max-w-3xl"
            style={{ animationDelay: '300ms' }}
          >
            Crisis Response{' '}
            <span className="italic text-royal">in Seconds</span>
          </h1>

          {/* Subtitle */}
          <p
            className="opacity-0 animate-fade-in-up text-center font-body
                       text-base sm:text-lg text-storm max-w-xl mt-6 leading-relaxed"
            style={{ animationDelay: '450ms' }}
          >
            Enter a company name and our AI agents will scan for the latest
            negative press&nbsp;&mdash; then help you craft the perfect response.
          </p>

          {/* ── Input Card ── */}
          <form
            onSubmit={handleSubmit}
            className="opacity-0 animate-fade-in-up w-full max-w-2xl mt-10"
            style={{ animationDelay: '600ms' }}
          >
            <div
              ref={formCardRef}
              className="relative group rounded-2xl border border-silver/30
                         bg-white shadow-[0_2px_20px_rgba(0,0,0,0.04)]
                         transition-all duration-300
                         focus-within:border-royal/30
                         focus-within:shadow-[0_4px_30px_rgba(43,58,143,0.08)]"
            >
              <textarea
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter a company name..."
                rows={3}
                className="w-full bg-transparent text-charcoal placeholder:text-silver
                           font-body text-base p-5 pr-16 resize-none outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <button
                type="submit"
                disabled={!url.trim()}
                className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-royal
                           flex items-center justify-center text-white
                           hover:scale-105 hover:shadow-[0_0_20px_rgba(43,58,143,0.3)]
                           active:scale-95 transition-all duration-200
                           disabled:opacity-25 disabled:hover:scale-100
                           disabled:hover:shadow-none"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </div>
          </form>

          {/* ─── 3D Spline: Secondary Element Container ───
              Positioned between input and cards.
              Set an explicit height (e.g. h-48 or h-64) and
              pointer-events-auto on the child when adding a Spline scene. */}
          <div
            className="relative w-full max-w-2xl h-0 z-[2] pointer-events-none"
            aria-hidden="true"
          >
            {/* 3D Spline model container — secondary element */}
          </div>

          {/* ── Demo Company Cards ── */}
          <section
            className="opacity-0 animate-fade-in-up w-full mt-24 mb-16"
            style={{ animationDelay: '800ms' }}
          >
            <p className="text-center text-xs font-body font-medium text-silver tracking-[0.2em] uppercase mb-12">
              Your Past Responses
            </p>

            {/* Mobile / Tablet: scrollable row */}
            <div className="flex lg:hidden gap-5 overflow-x-auto px-6 pb-4 snap-x snap-mandatory scrollbar-hide">
              {DEMO_COMPANIES.map((company) => (
                <TiltCard
                  key={company.companyKey}
                  className="min-w-[270px] snap-center"
                  onClick={() => onDemoClick(company.companyKey)}
                >
                  <DemoCardContent company={company} />
                </TiltCard>
              ))}
            </div>

            {/* Desktop: fanned layout */}
            <div className="hidden lg:block relative mx-auto max-w-5xl h-[420px]">
              {DEMO_COMPANIES.map((company, i) => (
                <TiltCard
                  key={company.companyKey}
                  className="absolute w-[300px]"
                  style={FAN_STYLES[i]}
                  onClick={() => onDemoClick(company.companyKey)}
                >
                  <DemoCardContent company={company} />
                </TiltCard>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
