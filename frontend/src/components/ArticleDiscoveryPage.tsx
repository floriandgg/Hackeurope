import { useState, useEffect, useRef, useCallback } from 'react';

/* ─── Types ─── */

interface Article {
  publisher: string;
  date: string;
  title: string;
  summary: string;
  criticality: number;
}

interface TopicGroup {
  name: string;
  summary: string;
  articles: Article[];
}

interface ExpandRect {
  top: number;
  left: number;
  width: number;
  height: number;
  fullWidth: number;
  fullHeight: number;
}

type ExpandPhase = 'idle' | 'start' | 'expanded' | 'collapsing';

/* ─── Mock Data ─── */

const AGENT_STEPS = [
  { label: 'Initializing search agents', detail: 'Deploying 3 specialized crawlers' },
  { label: 'Scanning news databases', detail: 'Querying Reuters, Bloomberg, AP, and 12 more sources' },
  { label: 'Analyzing sentiment patterns', detail: 'NLP processing across 847 candidate articles' },
  { label: 'Cross-referencing sources', detail: 'Validating claims across 6 independent outlets' },
  { label: 'Evaluating criticality scores', detail: 'Weighted scoring by reach, severity, and recency' },
  { label: 'Compiling final results', detail: '10 most critical articles selected' },
];

const TOPIC_GROUPS: TopicGroup[] = [
  {
    name: 'Data & Privacy',
    summary:
      'Multiple data protection failures and security vulnerabilities detected across business divisions.',
    articles: [
      {
        publisher: 'Reuters',
        date: 'Feb 19, 2026',
        title: 'Data Privacy Concerns Mount After Internal Audit Leak',
        summary:
          'Leaked audit documents reveal systemic data protection failures across multiple divisions.',
        criticality: 9,
      },
      {
        publisher: 'TechCrunch',
        date: 'Feb 16, 2026',
        title: 'Product Safety Report Flags Critical Vulnerabilities',
        summary:
          'Independent researchers identify multiple unpatched vulnerabilities in flagship product.',
        criticality: 8,
      },
      {
        publisher: 'Wired',
        date: 'Feb 12, 2026',
        title: 'AI Ethics Board Resignations Signal Internal Discord',
        summary:
          'Three board members step down over disagreements about AI deployment policies.',
        criticality: 6,
      },
    ],
  },
  {
    name: 'Financial & Governance',
    summary:
      'Regulatory scrutiny, leadership instability, and declining financial performance raise investor concerns.',
    articles: [
      {
        publisher: 'Financial Times',
        date: 'Feb 18, 2026',
        title: 'Regulatory Investigation Launched Over Market Practices',
        summary:
          'Federal regulators open inquiry into potentially anticompetitive business practices.',
        criticality: 9,
      },
      {
        publisher: 'The Wall Street Journal',
        date: 'Feb 17, 2026',
        title: 'Executive Leadership Shakeup Raises Governance Questions',
        summary:
          'Departure of two C-suite executives prompts investor concerns about stability.',
        criticality: 8,
      },
      {
        publisher: 'Bloomberg',
        date: 'Feb 15, 2026',
        title: 'Quarterly Earnings Fall Short of Projections',
        summary:
          'Revenue missed consensus by 12%, marking the third disappointing quarter.',
        criticality: 7,
      },
      {
        publisher: 'Associated Press',
        date: 'Feb 14, 2026',
        title: 'Employee Whistleblower Alleges Safety Issues',
        summary:
          'Former employee files complaint citing OSHA violations and management negligence.',
        criticality: 7,
      },
    ],
  },
  {
    name: 'Operations & Reputation',
    summary:
      'Supply chain disruptions and consumer backlash threaten brand reputation and operational continuity.',
    articles: [
      {
        publisher: 'The Guardian',
        date: 'Feb 13, 2026',
        title: 'Environmental Compliance Violations Surface in Report',
        summary:
          'Investigation documents repeated violations at three manufacturing facilities.',
        criticality: 6,
      },
      {
        publisher: 'CNBC',
        date: 'Feb 11, 2026',
        title: 'Supply Chain Disruptions Threaten Product Launch',
        summary:
          'Key supplier bankruptcy creates uncertainty for product availability.',
        criticality: 5,
      },
      {
        publisher: 'The New York Times',
        date: 'Feb 10, 2026',
        title: 'Consumer Backlash Over Pricing Changes',
        summary:
          'Petition with 200K signatures demands reversal of recent price increases.',
        criticality: 5,
      },
    ],
  },
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
            <div
              className="w-[195px] h-[195px] rounded-xl border p-4 cursor-pointer select-none flex flex-col transition-all duration-300"
              style={{
                backgroundColor: isHovered ? '#ffffff' : '#ffffff',
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
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Topic Cards Stack ─── */

function TopicCardsStack({
  visibleTopics,
  hidden,
  onSelectTopic,
  cardRefs,
}: {
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
      {TOPIC_GROUPS.map((topic, i) => {
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
  onBack: () => void;
}

export default function ArticleDiscoveryPage({
  companyName,
  onBack,
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

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    AGENT_STEPS.forEach((_, i) => {
      timers.push(setTimeout(() => setActiveStep(i), i * 650 + 300));
      timers.push(
        setTimeout(() => setCompletedSteps(i + 1), (i + 1) * 650 + 100),
      );
    });

    timers.push(setTimeout(() => setVisibleTopics(1), 2000));
    timers.push(setTimeout(() => setVisibleTopics(2), 2700));
    timers.push(setTimeout(() => setVisibleTopics(3), 3400));

    timers.push(
      setTimeout(
        () => setShowSummary(true),
        AGENT_STEPS.length * 650 + 400,
      ),
    );

    return () => timers.forEach(clearTimeout);
  }, []);

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

  const totalArticles = TOPIC_GROUPS.reduce(
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
                      <p className="text-2xl font-display text-royal">847</p>
                      <p className="text-[10px] text-storm mt-0.5">
                        Articles Scanned
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
                {totalArticles} articles across {TOPIC_GROUPS.length} crisis
                topics
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

              {/* Topic cards stack */}
              <TopicCardsStack
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
                    {selectedTopic !== null && (
                      <ExpandedContent
                        topic={TOPIC_GROUPS[selectedTopic]}
                        onBack={handleCollapse}
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
}: {
  topic: TopicGroup;
  onBack: () => void;
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
