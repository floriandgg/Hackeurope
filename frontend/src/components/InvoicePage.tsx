import { useState, useEffect, useCallback, useRef } from 'react';
import type { InvoiceData } from '../api';
import AgentScene from './AgentScene';

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

/* ─── Agent accent config ─── */

interface AgentAccent {
  color: string;
  bg: string;
  border: string;
  icon: string;
}

function getAgentAccent(agent: string): AgentAccent {
  const lower = agent.toLowerCase();
  if (lower.includes('historical'))
    return { color: '#2b3a8f', bg: 'rgba(43,58,143,0.06)', border: 'rgba(43,58,143,0.18)', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' };
  if (lower.includes('risk'))
    return { color: '#d97706', bg: 'rgba(217,119,6,0.06)', border: 'rgba(217,119,6,0.18)', icon: 'M13 10V3L4 14h7v7l9-11h-7z' };
  return { color: '#059669', bg: 'rgba(5,150,105,0.06)', border: 'rgba(5,150,105,0.18)', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' };
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
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, enabled]);

  return value;
}

/* ─── Animated bar width hook ─── */

function useAnimatedWidth(targetPercent: number, enabled: boolean, delay = 0) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!enabled) { setWidth(0); return; }
    const t = setTimeout(() => setWidth(targetPercent), delay);
    return () => clearTimeout(t);
  }, [enabled, targetPercent, delay]);
  return width;
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

function formatSavings(agency: number, ai: number): string {
  const saved = agency - ai;
  return formatEur(saved);
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
  const [showTotals, setShowTotals] = useState(false);

  const displayROI = useCountUp(
    invoiceData?.roiMultiplier ?? 0,
    1800,
    showHero,
  );

  // Mount animation — data is pre-loaded, so animate quickly
  useEffect(() => {
    if (!invoiceData) return;
    const timers: ReturnType<typeof setTimeout>[] = [];

    INVOICE_AGENT_STEPS.forEach((_, i) => {
      timers.push(setTimeout(() => setActiveStep(i), 150 + i * 200));
      timers.push(setTimeout(() => setCompletedSteps(i + 1), 150 + i * 200 + 150));
    });

    const timelineEnd = 150 + INVOICE_AGENT_STEPS.length * 200;
    timers.push(setTimeout(() => setShowHero(true), timelineEnd));

    const itemCount = invoiceData.lineItems.length;
    invoiceData.lineItems.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleItems(i + 1), timelineEnd + 400 + i * 200));
    });

    const afterItems = timelineEnd + 400 + itemCount * 200;
    timers.push(setTimeout(() => setShowTotals(true), afterItems + 150));
    timers.push(setTimeout(() => setShowTradeOff(true), afterItems + 350));
    timers.push(setTimeout(() => setShowSummary(true), afterItems + 550));

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
  const totalSaved = invoiceData.totalHumanEquivalentEur - invoiceData.totalApiCostEur;

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

              {/* Agent Scene */}
              <div className="mt-6">
                <AgentScene
                  scenario="invoice"
                  completedSteps={completedSteps}
                  activeStep={activeStep}
                  isDone={completedSteps >= INVOICE_AGENT_STEPS.length}
                />
              </div>
            </div>
          </aside>

          {/* Right Panel: Dashboard Content */}
          <main
            className="flex-1 flex flex-col px-6 lg:px-10 py-6 min-h-0 overflow-y-auto
                       opacity-0 animate-fade-in-up"
            style={{ animationDelay: '300ms' }}
          >
            {/* Header row: context + title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 shrink-0">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-royal opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-royal" />
                  </span>
                  <span className="text-[11px] font-body font-medium text-storm uppercase tracking-wider">
                    {companyName} &middot; {topic.name}
                  </span>
                </div>
                <h2 className="font-display text-2xl lg:text-3xl text-charcoal">
                  Cost Analysis
                </h2>
              </div>
              <p className="text-[13px] text-storm max-w-xs leading-relaxed">
                AI-powered crisis response vs traditional consulting agency
              </p>
            </div>

            {/* Action refused state */}
            {isRefused ? (
              <div
                className="flex-1 flex flex-col items-center justify-center"
                style={{
                  opacity: showHero ? 1 : 0,
                  transform: showHero ? 'translateY(0)' : 'translateY(20px)',
                  transition: 'opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)',
                }}
              >
                <div className="w-full max-w-lg p-8 rounded-2xl bg-white/80 border border-mist shadow-[0_2px_16px_rgba(0,0,0,0.04)] text-center mb-6">
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

                <div className="w-full max-w-lg p-5 rounded-xl bg-white/80 border border-mist shadow-[0_2px_12px_rgba(0,0,0,0.03)] text-center">
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
                {/* ──── KPI Strip ──── */}
                <div
                  className="grid grid-cols-3 gap-3 lg:gap-4 mb-6 shrink-0"
                  style={{
                    opacity: showHero ? 1 : 0,
                    transform: showHero ? 'translateY(0)' : 'translateY(16px)',
                    transition: 'opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)',
                  }}
                >
                  {/* Agency Cost */}
                  <div className="relative p-4 lg:p-5 rounded-xl bg-white/80 border border-mist shadow-[0_1px_8px_rgba(0,0,0,0.03)] overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-storm/20 to-storm/5" />
                    <p className="text-[10px] font-body font-medium text-storm/60 tracking-wider uppercase mb-2">
                      Agency Cost
                    </p>
                    <p className="text-xl lg:text-2xl font-display text-storm/40 line-through decoration-storm/20" style={{ fontFeatureSettings: '"tnum"' }}>
                      {formatEur(invoiceData.totalHumanEquivalentEur)}
                    </p>
                    <p className="text-[10px] text-storm/40 mt-1">traditional consulting</p>
                  </div>

                  {/* AI Cost */}
                  <div className="relative p-4 lg:p-5 rounded-xl bg-white/80 border border-royal/10 shadow-[0_1px_8px_rgba(43,58,143,0.04)] overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-royal/40 to-royal/10" />
                    <p className="text-[10px] font-body font-medium text-royal/60 tracking-wider uppercase mb-2">
                      AI Cost
                    </p>
                    <p className="text-xl lg:text-2xl font-display text-royal" style={{ fontFeatureSettings: '"tnum"' }}>
                      {formatApiCost(invoiceData.totalApiCostEur)}
                    </p>
                    <p className="text-[10px] text-royal/50 mt-1">agents pipeline</p>
                  </div>

                  {/* ROI */}
                  <div className="relative p-4 lg:p-5 rounded-xl bg-royal/[0.03] border border-royal/12 shadow-[0_1px_8px_rgba(43,58,143,0.05)] overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-royal to-royal/30" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(43,58,143,0.04),transparent_60%)] pointer-events-none" />
                    <p className="text-[10px] font-body font-medium text-royal/60 tracking-wider uppercase mb-2 relative">
                      ROI
                    </p>
                    <p className="text-xl lg:text-2xl font-display text-royal relative" style={{ fontFeatureSettings: '"tnum"' }}>
                      {displayROI.toLocaleString()}<span className="text-base lg:text-lg">&times;</span>
                    </p>
                    <p className="text-[10px] text-royal/50 mt-1 relative">cost reduction</p>
                  </div>
                </div>

                {/* ──── Agent Cost Cards Grid ──── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4 mb-4">
                  {invoiceData.lineItems.map((item, i) => {
                    const accent = getAgentAccent(item.agent);
                    const visible = i < visibleItems;
                    const savingsPercent = item.humanEquivalentValueEur > 0
                      ? ((item.humanEquivalentValueEur - item.apiComputeCostEur) / item.humanEquivalentValueEur) * 100
                      : 0;

                    return (
                      <AgentCostCard
                        key={item.event}
                        agent={item.agent}
                        detail={item.detail}
                        agencyCost={item.humanEquivalentValueEur}
                        aiCost={item.apiComputeCostEur}
                        margin={item.grossMarginPercent}
                        savingsPercent={savingsPercent}
                        accent={accent}
                        visible={visible}
                        index={i}
                      />
                    );
                  })}
                </div>

                {/* ──── Totals Bar ──── */}
                {showTotals && (
                  <div
                    className="rounded-xl border border-royal/12 bg-white/80 shadow-[0_2px_16px_rgba(43,58,143,0.05)] overflow-hidden mb-4 shrink-0
                               opacity-0 animate-fade-in-up"
                    style={{ animationDelay: '50ms' }}
                  >
                    <div className="flex flex-col sm:flex-row">
                      {/* Savings visualization */}
                      <div className="flex-1 p-5 lg:p-6">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-[13px] font-body font-semibold text-charcoal">
                            Total Savings
                          </h4>
                          <span className="text-[11px] font-body font-medium text-royal px-2.5 py-0.5 rounded-full bg-royal/[0.06]">
                            {displayROI.toLocaleString()}&times; ROI
                          </span>
                        </div>

                        {/* Dual bar comparison */}
                        <div className="space-y-2.5">
                          <CostBar
                            label="Agency"
                            value={formatEur(invoiceData.totalHumanEquivalentEur)}
                            percent={100}
                            color="#b4b8c0"
                            bgColor="rgba(180,184,192,0.12)"
                            enabled={showTotals}
                            strikethrough
                          />
                          <CostBar
                            label="AI"
                            value={formatApiCost(invoiceData.totalApiCostEur)}
                            percent={Math.max(0.5, (invoiceData.totalApiCostEur / invoiceData.totalHumanEquivalentEur) * 100)}
                            color="#2b3a8f"
                            bgColor="rgba(43,58,143,0.08)"
                            enabled={showTotals}
                            delay={200}
                          />
                        </div>
                      </div>

                      {/* Saved amount */}
                      <div className="sm:w-[180px] lg:w-[200px] p-5 lg:p-6 border-t sm:border-t-0 sm:border-l border-mist/60 flex flex-col items-center justify-center bg-royal/[0.015]">
                        <p className="text-[10px] font-body font-medium text-royal/60 tracking-wider uppercase mb-1">
                          You Saved
                        </p>
                        <p className="text-2xl font-display text-royal" style={{ fontFeatureSettings: '"tnum"' }}>
                          {formatSavings(invoiceData.totalHumanEquivalentEur, invoiceData.totalApiCostEur)}
                        </p>
                        <p className="text-[10px] text-storm/50 mt-0.5">
                          {invoiceData.totalGrossMarginPercent.toFixed(1)}% gross margin
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ──── Trade-off Reasoning ──── */}
                {showTradeOff && (
                  <div
                    className="rounded-xl bg-white/70 border border-mist shadow-[0_1px_8px_rgba(0,0,0,0.02)] p-5 shrink-0
                               opacity-0 animate-fade-in-up"
                    style={{ animationDelay: '80ms' }}
                  >
                    <div className="flex gap-3">
                      <div className="shrink-0 mt-0.5">
                        <div className="w-6 h-6 rounded-full bg-royal/[0.06] flex items-center justify-center">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2b3a8f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                          </svg>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-body font-medium text-royal tracking-[0.12em] uppercase mb-1.5">
                          How This Compares
                        </p>
                        <p className="text-[13px] font-body text-storm leading-relaxed">
                          {invoiceData.tradeOffReasoning}
                        </p>
                      </div>
                    </div>
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

/* ─── Agent Cost Card Component ─── */

function AgentCostCard({
  agent,
  detail,
  agencyCost,
  aiCost,
  margin,
  savingsPercent,
  accent,
  visible,
  index,
}: {
  agent: string;
  detail: string;
  agencyCost: number;
  aiCost: number;
  margin: number;
  savingsPercent: number;
  accent: AgentAccent;
  visible: boolean;
  index: number;
}) {
  const barWidth = useAnimatedWidth(Math.min(savingsPercent, 100), visible, 300);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: `opacity 0.6s cubic-bezier(0.16,1,0.3,1) ${index * 60}ms, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${index * 60}ms`,
      }}
    >
      <div
        className="h-full rounded-xl border bg-white/80 shadow-[0_1px_10px_rgba(0,0,0,0.03)] overflow-hidden
                   hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-shadow duration-300"
        style={{ borderColor: accent.border }}
      >
        {/* Top accent bar */}
        <div className="h-[3px]" style={{ backgroundColor: accent.color }} />

        <div className="p-4 lg:p-5 flex flex-col h-[calc(100%-3px)]">
          {/* Agent header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: accent.bg }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={accent.color}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={accent.icon} />
                </svg>
              </div>
              <div className="min-w-0">
                <h4 className="text-[13px] font-display text-charcoal leading-tight">
                  {agent}
                </h4>
                <p className="text-[10px] text-storm/60 mt-0.5 truncate">
                  {detail}
                </p>
              </div>
            </div>
          </div>

          {/* Cost rows */}
          <div className="flex-1 flex flex-col justify-end">
            {/* Savings bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-body font-medium text-storm/50 uppercase tracking-wider">Savings</span>
                <span className="text-[9px] font-body font-medium" style={{ color: accent.color }}>
                  {margin.toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-mist/60 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: accent.color,
                    opacity: 0.6,
                    transition: 'width 1.2s cubic-bezier(0.16,1,0.3,1)',
                  }}
                />
              </div>
            </div>

            {/* Agency vs AI cost */}
            <div className="flex items-end justify-between pt-2 border-t border-mist/40">
              <div>
                <p className="text-[9px] text-storm/45 uppercase tracking-wider mb-0.5">Agency</p>
                <p className="text-[15px] font-display text-storm/35 line-through decoration-storm/15">
                  {formatEur(agencyCost)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: `${accent.color}99` }}>AI</p>
                <p className="text-[15px] font-display" style={{ color: accent.color }}>
                  {formatApiCost(aiCost)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Cost Comparison Bar ─── */

function CostBar({
  label,
  value,
  percent,
  color,
  bgColor,
  enabled,
  delay = 0,
  strikethrough = false,
}: {
  label: string;
  value: string;
  percent: number;
  color: string;
  bgColor: string;
  enabled: boolean;
  delay?: number;
  strikethrough?: boolean;
}) {
  const barWidth = useAnimatedWidth(percent, enabled, delay);

  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-body font-medium text-storm/50 w-12 shrink-0 text-right uppercase tracking-wider">
        {label}
      </span>
      <div className="flex-1 h-6 rounded-md overflow-hidden relative" style={{ backgroundColor: bgColor }}>
        <div
          className="h-full rounded-md"
          style={{
            width: `${barWidth}%`,
            backgroundColor: color,
            opacity: strikethrough ? 0.25 : 0.5,
            transition: 'width 1s cubic-bezier(0.16,1,0.3,1)',
          }}
        />
        <span
          className={`absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-body font-medium ${
            strikethrough ? 'text-storm/40 line-through decoration-storm/20' : 'text-royal'
          }`}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
