import { useState, useEffect, useCallback, useRef } from 'react';
import type { InvoiceData } from '../api';

/* ─── Types ─── */

interface TopicInfo {
  name: string;
  summary: string;
}

interface InvoicePageProps {
  companyName: string;
  topic: TopicInfo;
  invoiceData: InvoiceData | null;
  onBack: () => void;
}

/* ─── Agent Timeline Steps ─── */

const INVOICE_AGENT_STEPS = [
  { label: 'Crisis articles detected', detail: 'Agent 1 collected and scored articles' },
  { label: 'Financial risk quantified', detail: 'Agent 3 estimated reach, churn, and VaR' },
  { label: 'Historical precedents found', detail: 'Agent 2 researched similar crises' },
  { label: 'Response strategies built', detail: 'Agent 4 generated plans and drafts' },
  { label: 'Costs aggregated', detail: 'Agent 5 computed API costs per agent' },
  { label: 'Invoice compiled', detail: 'ROI analysis complete' },
];

/* ─── Line item accent colors ─── */

function getAgentAccent(agent: string) {
  const lower = agent.toLowerCase();
  if (lower.includes('historical'))
    return { color: '#2b3a8f', bg: 'rgba(43,58,143,0.06)', border: 'rgba(43,58,143,0.2)' };
  if (lower.includes('risk'))
    return { color: '#d97706', bg: 'rgba(217,119,6,0.06)', border: 'rgba(217,119,6,0.2)' };
  return { color: '#059669', bg: 'rgba(5,150,105,0.06)', border: 'rgba(5,150,105,0.2)' };
}

/* ─── Animated count-up hook ─── */

function useCountUp(target: number, duration = 2000, enabled = false) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!enabled || target <= 0) {
      setValue(0);
      return;
    }
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, enabled]);

  return value;
}

/* ─── Helpers ─── */

function formatEur(value: number): string {
  if (value >= 1000) return `\u20ac${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (value >= 1) return `\u20ac${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `\u20ac${value.toFixed(2)}`;
}

function formatApiCost(value: number): string {
  if (value < 0.01) return `\u20ac${value.toFixed(4)}`;
  return `\u20ac${value.toFixed(2)}`;
}

/* ─── Main Page ─── */

export default function InvoicePage({
  companyName,
  topic,
  invoiceData,
  onBack,
}: InvoicePageProps) {
  const [completedSteps, setCompletedSteps] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [showHero, setShowHero] = useState(false);
  const [visibleItems, setVisibleItems] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [showTradeOff, setShowTradeOff] = useState(false);

  const displayROI = useCountUp(
    invoiceData?.roiMultiplier ?? 0,
    1800,
    showHero,
  );

  // Mount animation — data is pre-loaded, so animate quickly
  useEffect(() => {
    if (!invoiceData) return;
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Animate timeline steps (fast: 200ms per step)
    INVOICE_AGENT_STEPS.forEach((_, i) => {
      timers.push(setTimeout(() => setActiveStep(i), 150 + i * 200));
      timers.push(setTimeout(() => setCompletedSteps(i + 1), 150 + i * 200 + 150));
    });

    // Reveal hero after timeline completes
    const timelineEnd = 150 + INVOICE_AGENT_STEPS.length * 200;
    timers.push(setTimeout(() => setShowHero(true), timelineEnd));

    // Stagger line items
    const itemCount = invoiceData.lineItems.length;
    invoiceData.lineItems.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleItems(i + 1), timelineEnd + 500 + i * 150));
    });

    // Show trade-off + summary
    const afterItems = timelineEnd + 500 + itemCount * 150;
    timers.push(setTimeout(() => setShowTradeOff(true), afterItems + 200));
    timers.push(setTimeout(() => setShowSummary(true), afterItems + 400));

    return () => timers.forEach(clearTimeout);
  }, [invoiceData]);

  const handleBackToStrategy = useCallback(() => {
    onBack();
  }, [onBack]);

  if (!invoiceData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-storm text-sm">No invoice data available.</p>
      </div>
    );
  }

  const isRefused = invoiceData.actionRefused;

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

          <button
            onClick={handleBackToStrategy}
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
                  Full pipeline cost analysis
                </p>
              </div>

              {/* Timeline */}
              <div className="relative">
                {INVOICE_AGENT_STEPS.map((step, i) => {
                  const isCompleted = i < completedSteps;
                  const isActive = i === activeStep && i >= completedSteps;

                  return (
                    <div key={i} className="flex gap-3 relative">
                      {i < INVOICE_AGENT_STEPS.length - 1 && (
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
                      Invoice Ready
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-lg font-display text-royal">
                        {isRefused ? '\u2014' : `${displayROI.toLocaleString()}\u00d7`}
                      </p>
                      <p className="text-[10px] text-storm mt-0.5">
                        ROI Multiplier
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-display text-royal">
                        {invoiceData.lineItems.length}
                      </p>
                      <p className="text-[10px] text-storm mt-0.5">
                        Agents Billed
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
                Invoice for{' '}
                <span className="font-medium text-charcoal">{companyName}</span>
                {' \u00b7 '}
                <span className="text-royal">{topic.name}</span>
              </span>
            </div>

            {/* Section header */}
            <div className="text-center mb-2 shrink-0">
              <h2 className="font-display text-3xl text-charcoal mb-2">
                Cost Analysis
              </h2>
              <p className="text-sm text-storm max-w-lg mx-auto leading-relaxed">
                AI-powered crisis response vs traditional consulting agency
              </p>
            </div>

            {/* Action refused state */}
            {isRefused ? (
              <div
                className="w-full max-w-2xl mt-6"
                style={{
                  opacity: showHero ? 1 : 0,
                  transform: showHero ? 'translateY(0)' : 'translateY(20px)',
                  transition: 'opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)',
                }}
              >
                <div className="p-8 rounded-2xl bg-white/80 border border-mist shadow-[0_2px_16px_rgba(0,0,0,0.04)] text-center mb-6">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 12h8" />
                    </svg>
                  </div>
                  <h3 className="font-display text-2xl text-charcoal mb-2">No Billable Action</h3>
                  <p className="text-sm text-storm leading-relaxed mb-4">
                    {invoiceData.refusalReason}
                  </p>
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gray-200/60 bg-gray-50">
                    <span className="w-2 h-2 rounded-full bg-gray-400" />
                    <span className="text-[12px] font-body font-semibold text-gray-600">
                      Monitoring cost: {formatApiCost(invoiceData.totalApiCostEur)}
                    </span>
                  </div>
                </div>

                {/* Trade-off even for refused */}
                <div className="p-5 rounded-xl bg-white/80 border border-mist shadow-[0_2px_12px_rgba(0,0,0,0.03)] text-center">
                  <p className="text-[10px] font-body font-medium text-royal tracking-[0.15em] uppercase mb-2">
                    Cost Avoidance
                  </p>
                  <p className="text-[13px] font-body text-storm leading-relaxed italic">
                    {invoiceData.tradeOffReasoning}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* ROI Hero */}
                <div
                  className="w-full max-w-2xl mt-4 mb-8 shrink-0"
                  style={{
                    opacity: showHero ? 1 : 0,
                    transform: showHero ? 'translateY(0)' : 'translateY(20px)',
                    transition: 'opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)',
                  }}
                >
                  <div className="relative p-8 rounded-2xl bg-white/80 border border-mist shadow-[0_2px_16px_rgba(0,0,0,0.04)] text-center overflow-hidden">
                    {/* Subtle decorative accent */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(43,58,143,0.03),transparent_60%)] pointer-events-none" />

                    <div className="relative">
                      <p className="text-[10px] font-body font-medium text-royal tracking-[0.2em] uppercase mb-3">
                        Return on Investment
                      </p>
                      <p className="font-display text-6xl text-royal tracking-tight mb-1" style={{ fontFeatureSettings: '"tnum"' }}>
                        {displayROI.toLocaleString()}<span className="text-4xl">&times;</span>
                      </p>
                      <p className="text-[13px] text-storm mb-6">cost reduction achieved</p>

                      <div className="flex items-center justify-center gap-6">
                        <div>
                          <p className="text-2xl font-display text-storm/40 line-through decoration-storm/20">
                            {formatEur(invoiceData.totalHumanEquivalentEur)}
                          </p>
                          <p className="text-[11px] text-storm/60 mt-1">traditional agency</p>
                        </div>

                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2b3a8f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-40">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>

                        <div>
                          <p className="text-2xl font-display text-royal">
                            {formatApiCost(invoiceData.totalApiCostEur)}
                          </p>
                          <p className="text-[11px] text-royal/60 mt-1">AI-powered</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Line Items */}
                <div className="w-full max-w-2xl space-y-3 mb-8">
                  {invoiceData.lineItems.map((item, i) => {
                    const accent = getAgentAccent(item.agent);
                    const visible = i < visibleItems;

                    return (
                      <div
                        key={item.event}
                        style={{
                          opacity: visible ? 1 : 0,
                          transform: visible ? 'translateY(0)' : 'translateY(16px)',
                          transition: `opacity 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 60}ms, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 60}ms`,
                        }}
                      >
                        <div
                          className="rounded-xl border bg-white/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden"
                          style={{ borderColor: '#e8eaf0' }}
                        >
                          <div className="flex">
                            {/* Accent strip */}
                            <div
                              className="w-1 shrink-0"
                              style={{ backgroundColor: accent.color }}
                            />

                            <div className="flex-1 p-5">
                              {/* Header row */}
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2.5">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: accent.color, boxShadow: `0 0 6px ${accent.color}40` }}
                                  />
                                  <h4 className="text-[14px] font-display text-charcoal">
                                    {item.agent}
                                  </h4>
                                </div>
                                <span
                                  className="text-[10px] font-body font-medium px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: accent.bg, color: accent.color }}
                                >
                                  {item.grossMarginPercent.toFixed(1)}% margin
                                </span>
                              </div>

                              {/* Detail */}
                              <p className="text-[11px] text-storm/70 mb-3 pl-5">
                                {item.detail}
                              </p>

                              {/* Cost comparison */}
                              <div className="flex items-end gap-6 pl-5">
                                <div>
                                  <p className="text-[10px] text-storm/50 mb-0.5">Agency rate</p>
                                  <p className="text-lg font-display text-storm/40 line-through decoration-storm/20">
                                    {formatEur(item.humanEquivalentValueEur)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-royal/60 mb-0.5">AI cost</p>
                                  <p className="text-lg font-display text-royal">
                                    {formatApiCost(item.apiComputeCostEur)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Total row */}
                  {visibleItems >= invoiceData.lineItems.length && invoiceData.lineItems.length > 0 && (
                    <div
                      className="opacity-0 animate-fade-in-up"
                      style={{ animationDelay: '100ms' }}
                    >
                      <div className="rounded-xl border-2 border-royal/15 bg-royal/[0.02] shadow-[0_2px_16px_rgba(43,58,143,0.06)] overflow-hidden">
                        <div className="flex">
                          <div className="w-1 shrink-0 bg-royal" />
                          <div className="flex-1 p-5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-royal shrink-0" style={{ boxShadow: '0 0 8px rgba(43,58,143,0.4)' }} />
                                <h4 className="text-[14px] font-display text-charcoal font-medium">
                                  Total
                                </h4>
                              </div>
                              <span className="text-[12px] font-display text-royal font-medium">
                                {displayROI.toLocaleString()}&times; ROI
                              </span>
                            </div>

                            <div className="flex items-end gap-6 pl-5 mt-3">
                              <div>
                                <p className="text-[10px] text-storm/50 mb-0.5">Agency total</p>
                                <p className="text-xl font-display text-storm/40 line-through decoration-storm/20">
                                  {formatEur(invoiceData.totalHumanEquivalentEur)}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-royal/60 mb-0.5">Your total</p>
                                <p className="text-xl font-display text-royal">
                                  {formatApiCost(invoiceData.totalApiCostEur)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Trade-off reasoning */}
                {showTradeOff && (
                  <div
                    className="w-full max-w-2xl p-5 rounded-xl bg-white/80 border border-mist
                               shadow-[0_2px_12px_rgba(0,0,0,0.03)] text-center mb-6
                               opacity-0 animate-fade-in-up"
                    style={{ animationDelay: '100ms' }}
                  >
                    <p className="text-[10px] font-body font-medium text-royal tracking-[0.15em] uppercase mb-2">
                      How This Compares
                    </p>
                    <p className="text-[13px] font-body text-storm leading-relaxed">
                      {invoiceData.tradeOffReasoning}
                    </p>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
