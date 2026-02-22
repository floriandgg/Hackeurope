import { useState, useCallback } from 'react';

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

interface ToneMetric {
  label: string;
  value: number;
}


/* ═══════════════════════════════════════════════════════════════════
   Strategy Metadata
   ═══════════════════════════════════════════════════════════════════ */

const STRATEGY_META = [
  {
    name: 'Own It',
    color: '#22c55e',
    colorLight: 'rgba(34,197,94,0.1)',
    colorMid: 'rgba(34,197,94,0.3)',
    dotClass: 'bg-emerald-400',
  },
  {
    name: 'Reframe',
    color: '#f59e0b',
    colorLight: 'rgba(245,158,11,0.1)',
    colorMid: 'rgba(245,158,11,0.3)',
    dotClass: 'bg-amber-400',
  },
  {
    name: 'Hold the Line',
    color: '#ef4444',
    colorLight: 'rgba(239,68,68,0.1)',
    colorMid: 'rgba(239,68,68,0.3)',
    dotClass: 'bg-red-400',
  },
];

/* ═══════════════════════════════════════════════════════════════════
   Timeline Data
   ═══════════════════════════════════════════════════════════════════ */

const TIMELINE_NODES: TimelineNode[] = [
  { time: 'NOW', label: 'Internal alert', detail: 'CEO memo', channelIndex: 1 },
  { time: '+1 hour', label: 'Press statement', detail: 'goes live', channelIndex: 0 },
  { time: '+4 hours', label: 'Social campaign', detail: 'starts', channelIndex: 2 },
  { time: '+24 hours', label: 'Customer email', detail: 'blast', channelIndex: 3 },
  { time: '+72 hours', label: 'Follow-up report', detail: 'to board', channelIndex: 4 },
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

const EmailIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <path d="M22 6l-10 7L2 6" />
  </svg>
);

const QAIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const CHANNELS: Channel[] = [
  { name: 'Press Statement', icon: PressIcon },
  { name: 'CEO Memo', icon: MemoIcon },
  { name: 'Tweet Thread', icon: TweetIcon },
  { name: 'Customer Email', icon: EmailIcon },
  { name: 'Q&A Brief', icon: QAIcon },
];

/* ═══════════════════════════════════════════════════════════════════
   Draft Content Generator
   ═══════════════════════════════════════════════════════════════════ */

function getDrafts(company: string, topicName: string, strategyIndex: number): string[] {
  const topic = topicName.toLowerCase();

  if (strategyIndex === 0) {
    // Own It
    return [
      // Press Statement
      `FOR IMMEDIATE RELEASE

${company} Statement Regarding ${topicName} Concerns

${company} today acknowledged recent concerns regarding ${topic} issues affecting our operations. We take full responsibility for this situation and are committed to complete transparency with our stakeholders, customers, and the public.

"We recognize the severity of this matter and the trust our customers have placed in us," said ${company} leadership. "We are implementing immediate corrective measures and will provide regular updates as our internal review progresses."

Immediate actions being taken:
  •  Independent third-party review initiated
  •  Dedicated response team established
  •  Direct stakeholder communication program launched
  •  Regular progress updates committed to weekly cadence

${company} will host a press briefing within 48 hours to address questions directly. We remain committed to the highest standards of accountability and transparency.

Media Contact: press@${company.toLowerCase().replace(/\s+/g, '')}.com`,

      // CEO Memo
      `INTERNAL — CONFIDENTIAL

To: All ${company} Employees
From: Office of the CEO
Re: ${topicName} — Our Path Forward

Team,

I'm writing to address the ${topic} situation directly. You may have seen recent coverage, and I want you to hear it from me first.

We made mistakes. There's no way around that. But how we respond defines who we are.

Effective immediately, I'm personally overseeing our response. Here's what's happening:

1. Full internal audit launching today
2. External advisory board being assembled this week
3. Every affected stakeholder will receive direct communication
4. Weekly all-hands updates until this is fully resolved

I need each of you to uphold our values in every conversation — with customers, partners, and each other. If anyone asks, be honest: we're working on it, and we're taking it seriously.

My door is open. Reach out anytime.`,

      // Tweet Thread
      `A message from ${company} regarding recent ${topic} reports:

1/ We've been made aware of concerns regarding ${topic}. We take this seriously and want to be fully transparent about what happened and what we're doing about it.

2/ Here's what we know: there were legitimate issues in our ${topic} practices. We take full responsibility. No excuses.

3/ What we're doing RIGHT NOW:
  ✓  Independent review launched
  ✓  Dedicated response team active
  ✓  Customer support scaling up
  ✓  Weekly public updates committed

4/ We'll continue providing updates here. Your trust matters to us, and we intend to earn it back through action, not just words.

5/ If you've been affected or have questions, reach out to us directly. We're here. support@${company.toLowerCase().replace(/\s+/g, '')}.com`,

      // Customer Email
      `Subject: An Important Update from ${company}

Dear Valued Customer,

We're reaching out to personally inform you about the recent ${topic} concerns that have come to our attention. We believe you deserve to hear directly from us.

What happened: We identified issues related to ${topic} within our operations. We take full responsibility for this matter.

What we're doing:
  •  Launched an immediate independent review
  •  Assembled a dedicated response team
  •  Implementing enhanced safeguards across all systems
  •  Committed to ongoing transparency with regular updates

What this means for you: Your trust is our most important asset. We are committed to ensuring this does not impact your experience with us going forward.

If you have any questions or concerns, our dedicated support team is available 24/7 at support@${company.toLowerCase().replace(/\s+/g, '')}.com or by calling our direct line.

We appreciate your patience and continued trust.

Sincerely,
The ${company} Team`,

      // Q&A Brief
      `INTERNAL Q&A PREPARATION BRIEF
Classification: Leadership & Spokespeople Only
Subject: ${topicName} — Anticipated Questions & Approved Responses

Q: What happened?
A: ${company} identified issues related to ${topic} in our operations. We are taking full responsibility and have launched an immediate comprehensive review.

Q: When did you become aware of this?
A: We became aware of the full scope recently. As soon as we understood the situation, we initiated our response protocol and began direct stakeholder communication.

Q: Who was affected?
A: We are still determining the complete scope. We are proactively reaching out to all potentially affected parties rather than waiting for the final assessment.

Q: What are you doing about it?
A: We have taken immediate action: independent third-party review, dedicated response team, enhanced safeguards, and a commitment to weekly public progress updates.

Q: Why should stakeholders trust ${company} going forward?
A: Trust is earned through action, not words. Our immediate, transparent response — including accepting full responsibility before being forced to — demonstrates our commitment to doing the right thing.

BRIDGE PHRASES:
  •  "We take full responsibility..."
  •  "Our first priority is..."
  •  "We're committed to complete transparency..."
  •  "Actions speak louder than words, and here's what we're doing..."

DO NOT say: "no comment", "we're looking into it", "it's not as bad as reported"`,
    ];
  }

  if (strategyIndex === 1) {
    // Reframe
    return [
      `FOR IMMEDIATE RELEASE

${company} Announces Comprehensive Review and Forward-Looking Improvements

In response to recent discussions regarding ${topic}, ${company} today announced a series of proactive measures designed to strengthen our operations and reinforce our commitment to industry-leading standards.

"We've listened carefully to the concerns raised, and while the full picture is more nuanced than headlines suggest, we recognize this as an opportunity to raise the bar," said ${company} leadership.

Key initiatives announced:
  •  Comprehensive operational review with independent oversight
  •  Investment in enhanced systems and processes
  •  Formation of external advisory council
  •  Accelerated timeline for planned improvements

${company} has consistently been at the forefront of innovation in our industry, and these enhancements reflect our ongoing commitment to evolution and excellence.

Media Contact: press@${company.toLowerCase().replace(/\s+/g, '')}.com`,

      `INTERNAL — CONFIDENTIAL

To: All ${company} Employees
From: Office of the CEO
Re: ${topicName} — Context and Our Path Forward

Team,

You've likely seen coverage about ${topic}. I want to provide important context.

The situation is more complex than what's been reported. While there are areas where we need to improve — and we will — it's important to understand the full picture.

Here's what we're doing:
1. Conducting a thorough, fair review of the facts
2. Engaging external experts to guide improvements
3. Accelerating enhancements already in our roadmap
4. Communicating proactively with all stakeholders

Our narrative is clear: we're a company that listens, learns, and leads. This is an opportunity to demonstrate that.

Stay focused, stay proud of the work you do. We'll get through this stronger.`,

      `A statement from ${company} on recent ${topic} coverage:

1/ We're aware of recent reports about ${topic}. We want to address this directly and share what we're doing to move forward.

2/ Context matters: the situation is nuanced, and we're committed to a thorough, fair review of all the facts. What's clear is that there's room for improvement.

3/ We're not waiting — we're acting now:
  ✓  Independent operational review underway
  ✓  External advisory council forming
  ✓  Enhanced processes being fast-tracked
  ✓  Transparent progress reporting

4/ We've always believed in evolving and improving. This is another step in that journey. More updates to follow.`,

      `Subject: ${company} Update — Our Commitment to You

Dear Valued Customer,

We're writing regarding recent discussions about ${topic} in the media. We want to ensure you have the full picture.

While certain aspects of the coverage warrant attention — and we're taking them seriously — the reality is more nuanced. What matters most is what we do next.

We are:
  •  Conducting a comprehensive review with independent oversight
  •  Investing in enhanced systems and processes
  •  Forming an external advisory council
  •  Accelerating improvements already in our pipeline

Your experience with ${company} remains our top priority. These measures will make our service even stronger going forward.

Questions? Reach us anytime at support@${company.toLowerCase().replace(/\s+/g, '')}.com.

Best regards,
The ${company} Team`,

      `INTERNAL Q&A PREPARATION BRIEF
Classification: Spokespeople Only
Subject: ${topicName} — Approved Responses

Q: What happened?
A: Recent reports raised concerns about ${topic}. We've taken these seriously and launched a comprehensive review while also accelerating improvements already in our pipeline.

Q: Are you admitting fault?
A: We're focused on moving forward constructively. While no organization is perfect, we've always been committed to improvement, and this is another step in that evolution.

Q: What changes are being made?
A: We've initiated an independent review, formed an external advisory council, and are fast-tracking enhanced processes across our operations.

BRIDGE PHRASES:
  •  "We're focused on constructive progress..."
  •  "The full picture is more nuanced..."
  •  "This is an opportunity to raise the bar..."
  •  "We've always believed in continuous improvement..."

REDIRECT TOPICS: Industry innovations, customer satisfaction metrics, recent positive developments`,
    ];
  }

  // Hold the Line
  return [
    `FOR IMMEDIATE RELEASE

${company} Statement

${company} is aware of recent media reports regarding ${topic}. We are currently reviewing the matter through appropriate internal and legal channels.

${company} maintains rigorous standards across all operations and takes any allegations seriously. We will provide further comment at the appropriate time.

All inquiries should be directed to our legal department.

Legal Contact: legal@${company.toLowerCase().replace(/\s+/g, '')}.com`,

    `INTERNAL — CONFIDENTIAL — ATTORNEY-CLIENT PRIVILEGED

To: Senior Leadership Team
From: Office of the CEO / General Counsel
Re: ${topicName} — Handling Protocol

This memo is protected by attorney-client privilege. Do not distribute.

Regarding the ${topic} situation:
1. All external communications must be approved by Legal before release
2. Do not engage with media inquiries — redirect to our communications team
3. Internal discussions of this matter should be limited to need-to-know basis
4. Preserve all documents related to ${topic}

Our position: We maintain that our practices are within acceptable standards. We are conducting an internal review as a precautionary measure.

External counsel has been engaged and will be leading the review. Further guidance will be provided at our next senior leadership briefing.`,

    `${company} is aware of recent reports. We are reviewing the matter carefully and will share updates at the appropriate time. All inquiries: legal@${company.toLowerCase().replace(/\s+/g, '')}.com`,

    `Subject: Update from ${company}

Dear Customer,

We're aware of recent media coverage regarding our company. We want to assure you that ${company} maintains the highest standards in our operations.

We are currently reviewing the matters raised and will provide updates as appropriate. Your service and experience with us remain unchanged.

If you have specific concerns, please contact our support team.

Best regards,
${company} Customer Relations`,

    `INTERNAL Q&A BRIEF — STRICTLY CONFIDENTIAL
Legal Review: Required before any use
Subject: ${topicName}

Q: What is your response to the allegations?
A: We are aware of the reports and are reviewing the matter through appropriate channels. We will comment further at the appropriate time.

Q: [ANY follow-up question]
A: We have nothing further to add at this time. We encourage you to direct inquiries to our legal department.

APPROVED STATEMENTS ONLY. No improvisation.
All spokespeople must receive legal briefing before any media interaction.

DO NOT: Acknowledge specifics, speculate on outcomes, discuss internal processes, or deviate from approved language.`,
  ];
}

/* ═══════════════════════════════════════════════════════════════════
   Tone Analysis Data (per strategy)
   ═══════════════════════════════════════════════════════════════════ */

const TONE_DATA: ToneMetric[][] = [
  // Own It
  [
    { label: 'Empathy', value: 82 },
    { label: 'Urgency', value: 65 },
    { label: 'Authority', value: 95 },
    { label: 'Deflection', value: 12 },
    { label: 'Legal risk', value: 35 },
  ],
  // Reframe
  [
    { label: 'Empathy', value: 55 },
    { label: 'Urgency', value: 48 },
    { label: 'Authority', value: 88 },
    { label: 'Deflection', value: 52 },
    { label: 'Legal risk', value: 50 },
  ],
  // Hold the Line
  [
    { label: 'Empathy', value: 15 },
    { label: 'Urgency', value: 22 },
    { label: 'Authority', value: 90 },
    { label: 'Deflection', value: 78 },
    { label: 'Legal risk', value: 85 },
  ],
];

const READING_LEVELS = ['Grade 9', 'Grade 11', 'Grade 14'];


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
      <div className="relative flex items-start justify-between min-w-[600px] px-4 py-2">
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
   Tone Analysis Card
   ═══════════════════════════════════════════════════════════════════ */

function ToneAnalysisCard({
  metrics,
  readingLevel,
  strategyColor,
}: {
  metrics: ToneMetric[];
  readingLevel: string;
  strategyColor: string;
}) {
  return (
    <div className="rounded-2xl border border-mist bg-white p-6 shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-5">
        <h4 className="text-[11px] font-body font-semibold text-silver tracking-[0.15em] uppercase">
          Tone Analysis
        </h4>
        <div>
          <span className="text-[11px] font-body text-silver">Reading level:</span>
          <span className="text-[12px] font-body font-semibold text-charcoal ml-2">
            {readingLevel}
          </span>
          {readingLevel === 'Grade 9' && (
            <span className="text-[11px] text-emerald-600 ml-1.5">(accessible)</span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-8 gap-y-4">
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-body text-storm">{m.label}</span>
              <span className="text-[11px] font-body font-medium text-charcoal tabular-nums">
                {m.value}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-mist overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${m.value}%`,
                  backgroundColor: m.value > 70 ? strategyColor : m.value > 40 ? '#f59e0b' : '#e8eaf0',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════════ */

export default function DraftViewerPage({
  companyName,
  topic,
  strategyIndex,
  onBack,
}: DraftViewerPageProps) {
  const [activeChannel, setActiveChannel] = useState(0);
  const [copied, setCopied] = useState(false);

  const meta = STRATEGY_META[strategyIndex] ?? STRATEGY_META[0];
  const drafts = getDrafts(companyName, topic.name, strategyIndex);
  const toneMetrics = TONE_DATA[strategyIndex] ?? TONE_DATA[0];
  const readingLevel = READING_LEVELS[strategyIndex] ?? READING_LEVELS[0];

  // Map timeline click → channel
  const activeTimelineNode = TIMELINE_NODES.findIndex((n) => n.channelIndex === activeChannel);

  const handleTimelineClick = useCallback((nodeIndex: number) => {
    setActiveChannel(TIMELINE_NODES[nodeIndex].channelIndex);
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(drafts[activeChannel]).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [drafts, activeChannel]);

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
                {' · '}
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
              {/* Channel tabs — horizontal row above the draft */}
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
                  </div>
                </div>

                {/* Draft content */}
                <div className="flex-1 p-6 overflow-y-auto">
                  <pre
                    key={activeChannel}
                    className="font-body text-[13px] text-charcoal leading-relaxed whitespace-pre-wrap
                               opacity-0 animate-fade-in"
                  >
                    {drafts[activeChannel]}
                  </pre>
                </div>
              </div>
            </div>

            {/* ── Tone Analysis — full width ── */}
            <div
              className="opacity-0 animate-fade-in-up mb-8"
              style={{ animationDelay: '550ms' }}
            >
              <ToneAnalysisCard
                metrics={toneMetrics}
                readingLevel={readingLevel}
                strategyColor={meta.color}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
