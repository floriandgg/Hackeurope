import { useState, useCallback } from 'react';
import type { StrategyData } from '../api';

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

interface TopicInfo {
  name: string;
  summary: string;
}

interface DraftViewerPageProps {
  companyName: string;
  topic: TopicInfo;
  strategyIndex: number;
  strategyData: StrategyData | null;
  onBack: () => void;
}

interface TimelineNode {
  time: string;
  label: string;
  detail: string;
  channelIndex: number;
}

interface Channel {
  name: string;
  icon: React.ReactNode;
}


/* ═══════════════════════════════════════════════════════════════════
   Strategy color helpers
   ═══════════════════════════════════════════════════════════════════ */

function getStrategyMeta(strategyData: StrategyData | null, strategyIndex: number) {
  const strategy = strategyData?.strategies[strategyIndex];
  const name = strategy?.name ?? 'Strategy';
  const lower = name.toLowerCase();

  if (lower.includes('offensive')) {
    return {
      name,
      color: '#ef4444',
      colorLight: 'rgba(239,68,68,0.1)',
      colorMid: 'rgba(239,68,68,0.3)',
      dotClass: 'bg-red-400',
    };
  }
  if (lower.includes('diplomate') || lower.includes('diplomat')) {
    return {
      name,
      color: '#22c55e',
      colorLight: 'rgba(34,197,94,0.1)',
      colorMid: 'rgba(34,197,94,0.3)',
      dotClass: 'bg-emerald-400',
    };
  }
  // Silence or fallback
  return {
    name,
    color: '#6b7280',
    colorLight: 'rgba(107,114,128,0.1)',
    colorMid: 'rgba(107,114,128,0.3)',
    dotClass: 'bg-gray-400',
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Timeline Data
   ═══════════════════════════════════════════════════════════════════ */

const TIMELINE_NODES: TimelineNode[] = [
  { time: 'NOW', label: 'Internal alert', detail: 'CEO memo', channelIndex: 1 },
  { time: '+1 hour', label: 'Press statement', detail: 'goes live', channelIndex: 0 },
  { time: '+4 hours', label: 'Social campaign', detail: 'starts', channelIndex: 2 },
  { time: '+24 hours', label: 'Legal notice', detail: 'if needed', channelIndex: 3 },
];

/* ═══════════════════════════════════════════════════════════════════
   Channel Icons (SVGs)
   ═══════════════════════════════════════════════════════════════════ */

const PressIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
    <path d="M18 14h-8M15 18h-5M10 6h8v4h-8z" />
  </svg>
);

const MemoIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
  </svg>
);

const TweetIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const LegalIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 12l10 5 10-5" />
  </svg>
);

const CHANNELS: Channel[] = [
  { name: 'Press Release', icon: PressIcon },
  { name: 'Internal Email', icon: MemoIcon },
  { name: 'Social Post', icon: TweetIcon },
  { name: 'Legal Notice', icon: LegalIcon },
];


/* ═══════════════════════════════════════════════════════════════════
   Crisis Timeline Component
   ═══════════════════════════════════════════════════════════════════ */

function CrisisTimeline({
  activeNode,
  onNodeClick,
  strategyColor,
}: {
  activeNode: number;
  onNodeClick: (index: number) => void;
  strategyColor: string;
}) {
  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <div className="relative flex items-start justify-between min-w-[500px] px-4 py-2">
        {/* Connecting line */}
        <div
          className="absolute top-[39px] left-[calc(10%)] right-[calc(10%)] h-[2px]"
          style={{ backgroundColor: '#e8eaf0' }}
        />
        {/* Progress fill */}
        <div
          className="absolute top-[39px] left-[calc(10%)] h-[2px] transition-all duration-500 ease-out"
          style={{
            width: `${(activeNode / (TIMELINE_NODES.length - 1)) * 80}%`,
            backgroundColor: strategyColor,
          }}
        />

        {TIMELINE_NODES.map((node, i) => {
          const isActive = i === activeNode;
          const isPast = i < activeNode;

          return (
            <button
              key={i}
              onClick={() => onNodeClick(i)}
              className="relative flex flex-col items-center flex-1 group outline-none"
            >
              {/* Time label */}
              <span
                className="text-[11px] font-body font-semibold mb-2.5 transition-colors duration-200"
                style={{ color: isActive ? strategyColor : isPast ? '#2d3038' : '#b4b8c0' }}
              >
                {node.time}
              </span>

              {/* Node dot */}
              <div
                className="relative w-7 h-7 rounded-full flex items-center justify-center
                           transition-all duration-300 z-10"
                style={{
                  backgroundColor: isActive
                    ? strategyColor
                    : isPast
                      ? strategyColor
                      : '#ffffff',
                  border: isActive || isPast
                    ? 'none'
                    : '2px solid #e8eaf0',
                  boxShadow: isActive
                    ? `0 0 0 4px ${strategyColor}25, 0 0 16px ${strategyColor}30`
                    : 'none',
                  transform: isActive ? 'scale(1.15)' : 'scale(1)',
                }}
              >
                {(isActive || isPast) && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>

              {/* Label */}
              <span
                className="text-[12px] font-body font-medium mt-2.5 transition-colors duration-200"
                style={{ color: isActive ? '#2d3038' : isPast ? '#6d8a9e' : '#b4b8c0' }}
              >
                {node.label}
              </span>
              <span
                className="text-[10px] font-body transition-colors duration-200"
                style={{ color: isActive ? '#6d8a9e' : '#b4b8c0' }}
              >
                {node.detail}
              </span>
            </button>
          );
        })}

        {/* Arrow at end */}
        <div className="absolute top-[35px] right-[calc(10%-12px)]">
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
            <path d="M0 5h10M7 1l4 4-4 4" stroke="#e8eaf0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   Draft Content Helper
   ═══════════════════════════════════════════════════════════════════ */

function getDraftContent(strategyData: StrategyData | null, channelIndex: number): string {
  if (!strategyData) return '';
  const drafts = strategyData.drafts;
  switch (channelIndex) {
    case 0: return drafts.pressRelease;
    case 1: return drafts.internalEmail;
    case 2: return drafts.socialPost;
    case 3: return drafts.legalNotice;
    default: return '';
  }
}


/* ═══════════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════════ */

export default function DraftViewerPage({
  companyName,
  topic,
  strategyIndex,
  strategyData,
  onBack,
}: DraftViewerPageProps) {
  const [activeChannel, setActiveChannel] = useState(0);
  const [copied, setCopied] = useState(false);

  const meta = getStrategyMeta(strategyData, strategyIndex);
  const draftText = getDraftContent(strategyData, activeChannel);
  // Map timeline click -> channel
  const activeTimelineNode = TIMELINE_NODES.findIndex((n) => n.channelIndex === activeChannel);

  const handleTimelineClick = useCallback((nodeIndex: number) => {
    setActiveChannel(TIMELINE_NODES[nodeIndex].channelIndex);
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(draftText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [draftText]);

  // Legal notice empty state
  const isLegalEmpty = activeChannel === 3 && !draftText.trim();

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
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-royal shrink-0">
              <path d="M12 2l8 4v6c0 5.25-3.5 9.74-8 11-4.5-1.26-8-5.75-8-11V6l8-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M12 8v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1" fill="currentColor" />
            </svg>
            <span className="font-display text-xl text-charcoal tracking-tight">
              Crisis PR Agent
            </span>
          </div>

          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-body font-medium px-5 py-2 rounded-full
                       border border-silver/30 text-storm
                       hover:text-charcoal hover:border-silver/60
                       transition-all duration-200"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Strategy
          </button>
        </nav>

        {/* ── Scrollable Content ── */}
        <main className="flex-1 overflow-y-auto px-6 lg:px-10 pb-16">
          <div className="max-w-6xl mx-auto">
            {/* ── Header ── */}
            <div
              className="text-center mb-8 opacity-0 animate-fade-in-up"
              style={{ animationDelay: '150ms' }}
            >
              <div className="flex items-center justify-center gap-3 mb-3">
                <span
                  className={`w-3.5 h-3.5 rounded-full ${meta.dotClass}`}
                  style={{ boxShadow: `0 0 8px ${meta.color}60` }}
                />
                <h2 className="font-display text-3xl text-charcoal tracking-tight">
                  {meta.name} Strategy
                </h2>
              </div>
              <p className="text-sm text-storm">
                <span className="font-medium text-charcoal">{companyName}</span>
                {' \u00b7 '}
                <span className="text-royal/80">{topic.name}</span>
              </p>
            </div>

            {/* ── Crisis Timeline ── */}
            <div
              className="rounded-2xl border border-mist bg-white p-6 shadow-[0_2px_16px_rgba(0,0,0,0.04)]
                         mb-8 opacity-0 animate-fade-in-up"
              style={{ animationDelay: '250ms' }}
            >
              <h4 className="text-[11px] font-body font-semibold text-silver tracking-[0.15em] uppercase mb-4">
                Crisis Timeline
              </h4>
              <CrisisTimeline
                activeNode={activeTimelineNode >= 0 ? activeTimelineNode : 0}
                onNodeClick={handleTimelineClick}
                strategyColor={meta.color}
              />
            </div>

            {/* ── Channel Tabs + Draft Viewer ── */}
            <div
              className="mb-8 opacity-0 animate-fade-in-up"
              style={{ animationDelay: '400ms' }}
            >
              {/* Channel tabs */}
              <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4">
                {CHANNELS.map((ch, i) => {
                  const isActive = i === activeChannel;
                  return (
                    <button
                      key={ch.name}
                      onClick={() => setActiveChannel(i)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border
                                 whitespace-nowrap transition-all duration-200 shrink-0"
                      style={{
                        backgroundColor: isActive ? meta.colorLight : '#ffffff',
                        borderColor: isActive ? meta.colorMid : '#e8eaf0',
                        boxShadow: isActive
                          ? `0 2px 12px ${meta.color}15`
                          : '0 1px 4px rgba(0,0,0,0.03)',
                      }}
                    >
                      <span
                        className="transition-colors duration-200"
                        style={{ color: isActive ? meta.color : '#6d8a9e' }}
                      >
                        {ch.icon}
                      </span>
                      <span
                        className="text-[13px] font-body font-medium transition-colors duration-200"
                        style={{ color: isActive ? '#2d3038' : '#6d8a9e' }}
                      >
                        {ch.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Draft viewer */}
              <div className="rounded-2xl border border-mist bg-white shadow-[0_2px_16px_rgba(0,0,0,0.04)] flex flex-col min-h-[400px]">
                {/* Draft header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-mist">
                  <div className="flex items-center gap-2.5">
                    <span style={{ color: meta.color }}>{CHANNELS[activeChannel].icon}</span>
                    <span className="text-[14px] font-body font-semibold text-charcoal">
                      {CHANNELS[activeChannel].name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isLegalEmpty && (
                      <>
                        <button
                          onClick={handleCopy}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-silver/30
                                     text-[12px] font-body font-medium text-storm
                                     hover:text-charcoal hover:border-silver/60
                                     transition-all duration-200"
                        >
                          {copied ? (
                            <>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                              Copied
                            </>
                          ) : (
                            <>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                        <button
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-silver/30
                                     text-[12px] font-body font-medium text-storm
                                     hover:text-charcoal hover:border-silver/60
                                     transition-all duration-200"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          Edit
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Draft content */}
                <div className="flex-1 p-6 overflow-y-auto">
                  {isLegalEmpty ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                      <svg
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#b4b8c0"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mb-4"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4M12 16h.01" />
                      </svg>
                      <p className="text-[14px] font-body font-medium text-storm mb-1">
                        Not applicable at this alert level
                      </p>
                      <p className="text-[12px] font-body text-silver max-w-xs">
                        Legal notices are only generated when the crisis alert level is CRITICAL.
                        The current alert level is {strategyData?.alertLevel ?? 'N/A'}.
                      </p>
                    </div>
                  ) : (
                    <pre
                      key={activeChannel}
                      className="font-body text-[13px] text-charcoal leading-relaxed whitespace-pre-wrap
                                 opacity-0 animate-fade-in"
                    >
                      {draftText || 'No draft content available.'}
                    </pre>
                  )}
                </div>
              </div>
            </div>


          </div>
        </main>
      </div>
    </div>
  );
}
