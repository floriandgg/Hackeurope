/* ─── Backend integration: Agent 1 (The Watcher) ─── */

/** Article shape returned by the backend */
export interface BackendArticle {
  title: string;
  summary: string;
  url: string;
  pub_date: string | null;
  author: string;
  subject: string;
  sentiment: string;
  authority_score: number;
  severity_score: number;
  recency_multiplier: number;
  exposure_score: number;
}

/** Subject group returned by the backend */
export interface BackendSubject {
  subject: string;
  title: string;
  summary: string;
  article_count: number;
  articles: BackendArticle[];
}

/** Full response from POST /api/search */
export interface SearchResponse {
  company_name: string;
  crisis_id: string;
  subjects: BackendSubject[];
}

/* ─── Frontend types (what the UI consumes) ─── */

export interface Article {
  publisher: string;
  date: string;
  title: string;
  summary: string;
  criticality: number;
  url: string;
  subject: string;
  severityScore: number;
}

export interface TopicGroup {
  name: string;
  summary: string;
  articles: Article[];
}

/* ─── Agent 2 types ─── */

/** Single precedent case as returned by the backend */
interface BackendPrecedent {
  company: string;
  year: string;
  crisis_summary: string;
  crisis_title: string;
  crisis_type: string;
  strategy_adopted: string;
  outcome: string;
  success_score: number;
  lesson: string;
  source_url: string;
}

/** Full response from POST /api/precedents */
interface PrecedentsResponse {
  precedents: BackendPrecedent[];
  global_lesson: string;
  confidence: string;
}

/** Article inside a PrecedentCase (for display) */
export interface PrecedentArticle {
  publisher: string;
  title: string;
  date: string;
  url: string;
}

/** Frontend-ready precedent case */
export interface PrecedentCase {
  company: string;
  year: string;
  crisis: string;
  crisisType: string;
  strategy: string;
  outcome: 'positive' | 'negative';
  outcomeLabel: string;
  lesson: string;
  articles: PrecedentArticle[];
}

/** Entire Agent 2 result for the frontend */
export interface PrecedentsData {
  cases: PrecedentCase[];
  globalLesson: string;
  confidence: string;
}

/* ─── Helpers ─── */

/** Extract a human-readable publisher name from a URL */
function extractPublisher(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    // Map common domains to display names
    const known: Record<string, string> = {
      'reuters.com': 'Reuters',
      'bloomberg.com': 'Bloomberg',
      'nytimes.com': 'The New York Times',
      'wsj.com': 'The Wall Street Journal',
      'ft.com': 'Financial Times',
      'theguardian.com': 'The Guardian',
      'bbc.com': 'BBC',
      'bbc.co.uk': 'BBC',
      'cnbc.com': 'CNBC',
      'cnn.com': 'CNN',
      'apnews.com': 'Associated Press',
      'techcrunch.com': 'TechCrunch',
      'wired.com': 'Wired',
      'theverge.com': 'The Verge',
      'arstechnica.com': 'Ars Technica',
      'washingtonpost.com': 'Washington Post',
      'forbes.com': 'Forbes',
      'businessinsider.com': 'Business Insider',
      'yahoo.com': 'Yahoo News',
      'news.yahoo.com': 'Yahoo News',
      'finance.yahoo.com': 'Yahoo Finance',
      'abc.net.au': 'ABC News',
      'abcnews.go.com': 'ABC News',
      'nbcnews.com': 'NBC News',
      'foxnews.com': 'Fox News',
      'politico.com': 'Politico',
      'axios.com': 'Axios',
      'time.com': 'TIME',
    };
    return known[hostname] ?? capitalizeHostname(hostname);
  } catch {
    return 'News Source';
  }
}

function capitalizeHostname(hostname: string): string {
  // "techcrunch.com" → "Techcrunch" — strip TLD, capitalize
  const name = hostname.split('.')[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Format ISO date string to "Feb 19, 2026" */
function formatDate(isoDate: string | null): string {
  if (!isoDate) return 'Recent';
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return 'Recent';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recent';
  }
}

/**
 * Normalize exposure_score to a 1–10 criticality integer.
 *
 * Exposure scores are unbounded (typically 0–120+).
 * We use a log-based scale with sensible thresholds:
 *   score ≤ 2  → 1
 *   score ~ 5  → 3
 *   score ~ 15 → 5
 *   score ~ 30 → 7
 *   score ~ 50 → 8
 *   score ≥ 80 → 10
 */
function normalizeCriticality(exposureScore: number): number {
  if (exposureScore <= 0) return 1;
  // log-based mapping: criticality = clamp(1, round(2.2 * ln(score)), 10)
  const raw = Math.round(2.2 * Math.log(exposureScore));
  return Math.max(1, Math.min(10, raw));
}

/* ─── Transform: Agent 1 ─── */

export function transformSubjects(subjects: BackendSubject[]): TopicGroup[] {
  return subjects.map((subj) => ({
    name: subj.title,
    summary: subj.summary,
    articles: subj.articles.map((a) => ({
      publisher: extractPublisher(a.url),
      date: formatDate(a.pub_date),
      title: a.title,
      summary: a.summary,
      criticality: normalizeCriticality(a.exposure_score),
      url: a.url,
      subject: a.subject,
      severityScore: a.severity_score,
    })),
  }));
}

/* ─── Transform: Agent 2 ─── */

export function transformPrecedents(data: PrecedentsResponse): PrecedentsData {
  const cases: PrecedentCase[] = data.precedents.map((p) => {
    const articles: PrecedentArticle[] = [];
    if (p.source_url) {
      articles.push({
        publisher: extractPublisher(p.source_url),
        title: p.crisis_title || p.crisis_summary.slice(0, 60),
        date: p.year || '',
        url: p.source_url,
      });
    }

    return {
      company: p.company,
      year: p.year || '',
      crisis: p.crisis_title || p.crisis_summary.slice(0, 60),
      crisisType: p.crisis_type || 'Corporate Crisis',
      strategy: p.strategy_adopted,
      outcome: p.success_score >= 6 ? 'positive' as const : 'negative' as const,
      outcomeLabel: p.outcome,
      lesson: p.lesson || p.crisis_summary,
      articles,
    };
  });

  return {
    cases,
    globalLesson: data.global_lesson,
    confidence: data.confidence,
  };
}

/* ─── Agent 5 types ─── */

/** Single invoice line item from the backend */
interface BackendInvoiceLineItem {
  agent: string;
  event: string;
  human_equivalent_value_eur: number;
  api_compute_cost_eur: number;
  gross_margin_percent: number;
  detail: string;
}

/** Full invoice from the backend */
interface BackendInvoice {
  line_items: BackendInvoiceLineItem[];
  total_human_equivalent_eur: number;
  total_api_cost_eur: number;
  total_gross_margin_percent: number;
  roi_multiplier: number;
  invoice_summary: string;
  trade_off_reasoning: string;
  action_refused: boolean;
  refusal_reason: string;
}

/** Frontend-ready invoice line item */
export interface InvoiceLineItem {
  agent: string;
  event: string;
  humanEquivalentValueEur: number;
  apiComputeCostEur: number;
  grossMarginPercent: number;
  detail: string;
}

/** Frontend-ready invoice data */
export interface InvoiceData {
  lineItems: InvoiceLineItem[];
  totalHumanEquivalentEur: number;
  totalApiCostEur: number;
  totalGrossMarginPercent: number;
  roiMultiplier: number;
  invoiceSummary: string;
  tradeOffReasoning: string;
  actionRefused: boolean;
  refusalReason: string;
}

/* ─── Agent 4 types ─── */

/** Single strategy from the backend */
interface BackendCrisisStrategy {
  name: string;
  description: string;
  tone: string;
  channels: string[];
  key_actions: string[];
  estimated_cost_eur: number;
  estimated_impact: string;
  roi_score: number;
}

/** Full strategy report from the backend */
interface BackendStrategyReport {
  alert_level: string;
  alert_reasoning: string;
  recommended_action: string;
  strategies: BackendCrisisStrategy[];
  recommended_strategy: string;
  recommendation_reasoning: string;
  press_release: string;
  internal_email: string;
  social_post: string;
  legal_notice_draft: string;
  decision_summary: string;
}

/** Full response from POST /api/crisis-response */
export interface CrisisResponseResponse {
  strategy_report: BackendStrategyReport;
  recommended_strategy_name: string;
  precedents: BackendPrecedent[];
  global_lesson: string;
  confidence: string;
  invoice?: BackendInvoice;
}

/** Frontend-ready strategy (one of 3) */
export interface FrontendStrategy {
  name: string;
  description: string;
  tone: string;
  channels: string[];
  keyActions: string[];
  estimatedCostEur: number;
  estimatedImpact: string;
  roiScore: number;
}

/** Frontend-ready strategy data */
export interface StrategyData {
  alertLevel: string;
  alertReasoning: string;
  recommendedAction: string;
  strategies: FrontendStrategy[];
  recommendedStrategy: string;
  recommendationReasoning: string;
  drafts: {
    pressRelease: string;
    internalEmail: string;
    socialPost: string;
    legalNotice: string;
  };
  decisionSummary: string;
}

/* ─── Transform: Agent 4 ─── */

export function transformStrategyReport(data: CrisisResponseResponse): StrategyData {
  const r = data.strategy_report;
  if (!r || !r.strategies || r.strategies.length === 0) {
    throw new Error('Backend returned empty strategy report — Agent 4 may have failed.');
  }
  return {
    alertLevel: r.alert_level || 'MEDIUM',
    alertReasoning: r.alert_reasoning || '',
    recommendedAction: r.recommended_action || 'communicate',
    strategies: r.strategies.map((s) => ({
      name: s.name,
      description: s.description || '',
      tone: s.tone || '',
      channels: s.channels || [],
      keyActions: s.key_actions || [],
      estimatedCostEur: s.estimated_cost_eur || 0,
      estimatedImpact: s.estimated_impact || '',
      roiScore: s.roi_score || 0,
    })),
    recommendedStrategy: r.recommended_strategy || '',
    recommendationReasoning: r.recommendation_reasoning || '',
    drafts: {
      pressRelease: r.press_release || '',
      internalEmail: r.internal_email || '',
      socialPost: r.social_post || '',
      legalNotice: r.legal_notice_draft || '',
    },
    decisionSummary: r.decision_summary || '',
  };
}

/* ─── Transform: Agent 5 ─── */

export function transformInvoice(data: BackendInvoice): InvoiceData {
  return {
    lineItems: (data.line_items || []).map((li) => ({
      agent: li.agent,
      event: li.event,
      humanEquivalentValueEur: li.human_equivalent_value_eur || 0,
      apiComputeCostEur: li.api_compute_cost_eur || 0,
      grossMarginPercent: li.gross_margin_percent || 0,
      detail: li.detail || '',
    })),
    totalHumanEquivalentEur: data.total_human_equivalent_eur || 0,
    totalApiCostEur: data.total_api_cost_eur || 0,
    totalGrossMarginPercent: data.total_gross_margin_percent || 0,
    roiMultiplier: data.roi_multiplier || 0,
    invoiceSummary: data.invoice_summary || '',
    tradeOffReasoning: data.trade_off_reasoning || '',
    actionRefused: data.action_refused || false,
    refusalReason: data.refusal_reason || '',
  };
}

/* ─── Debug mock data: Agent 1 ─── */

const MOCK_TOPICS: TopicGroup[] = [
  {
    name: 'Security & Fraud',
    summary:
      'Leaked audit documents reveal systemic data protection failures across multiple divisions.',
    articles: [
      {
        publisher: 'Reuters',
        date: 'Feb 19, 2026',
        title: 'Data Privacy Concerns Mount After Internal Audit Leak',
        summary: 'Leaked audit documents reveal systemic data protection failures across multiple divisions.',
        criticality: 9,
        url: 'https://reuters.com/example',
        subject: 'security_fraud',
        severityScore: 4,
      },
      {
        publisher: 'TechCrunch',
        date: 'Feb 16, 2026',
        title: 'Product Safety Report Flags Critical Vulnerabilities',
        summary: 'Independent researchers identify multiple unpatched vulnerabilities in flagship product.',
        criticality: 8,
        url: 'https://techcrunch.com/example',
        subject: 'security_fraud',
        severityScore: 4,
      },
      {
        publisher: 'Wired',
        date: 'Feb 12, 2026',
        title: 'AI Ethics Board Resignations Signal Internal Discord',
        summary: 'Three board members step down over disagreements about AI deployment policies.',
        criticality: 6,
        url: 'https://wired.com/example',
        subject: 'security_fraud',
        severityScore: 3,
      },
    ],
  },
  {
    name: 'Legal & Compliance',
    summary:
      'Regulatory scrutiny, leadership instability, and declining financial performance raise investor concerns.',
    articles: [
      {
        publisher: 'Financial Times',
        date: 'Feb 18, 2026',
        title: 'Regulatory Investigation Launched Over Market Practices',
        summary: 'Federal regulators open inquiry into potentially anticompetitive business practices.',
        criticality: 9,
        url: 'https://ft.com/example',
        subject: 'legal_compliance',
        severityScore: 4,
      },
      {
        publisher: 'The Wall Street Journal',
        date: 'Feb 17, 2026',
        title: 'Executive Leadership Shakeup Raises Governance Questions',
        summary: 'Departure of two C-suite executives prompts investor concerns about stability.',
        criticality: 8,
        url: 'https://wsj.com/example',
        subject: 'legal_compliance',
        severityScore: 3,
      },
      {
        publisher: 'Bloomberg',
        date: 'Feb 15, 2026',
        title: 'Quarterly Earnings Fall Short of Projections',
        summary: 'Revenue missed consensus by 12%, marking the third disappointing quarter.',
        criticality: 7,
        url: 'https://bloomberg.com/example',
        subject: 'legal_compliance',
        severityScore: 3,
      },
      {
        publisher: 'Associated Press',
        date: 'Feb 14, 2026',
        title: 'Employee Whistleblower Alleges Safety Issues',
        summary: 'Former employee files complaint citing OSHA violations and management negligence.',
        criticality: 7,
        url: 'https://apnews.com/example',
        subject: 'legal_compliance',
        severityScore: 3,
      },
    ],
  },
  {
    name: 'Ethics & Management',
    summary:
      'Supply chain disruptions and consumer backlash threaten brand reputation and operational continuity.',
    articles: [
      {
        publisher: 'The Guardian',
        date: 'Feb 13, 2026',
        title: 'Environmental Compliance Violations Surface in Report',
        summary: 'Investigation documents repeated violations at three manufacturing facilities.',
        criticality: 6,
        url: 'https://theguardian.com/example',
        subject: 'ethics_management',
        severityScore: 3,
      },
      {
        publisher: 'CNBC',
        date: 'Feb 11, 2026',
        title: 'Supply Chain Disruptions Threaten Product Launch',
        summary: 'Key supplier bankruptcy creates uncertainty for product availability.',
        criticality: 5,
        url: 'https://cnbc.com/example',
        subject: 'ethics_management',
        severityScore: 2,
      },
      {
        publisher: 'The New York Times',
        date: 'Feb 10, 2026',
        title: 'Consumer Backlash Over Pricing Changes',
        summary: 'Petition with 200K signatures demands reversal of recent price increases.',
        criticality: 5,
        url: 'https://nytimes.com/example',
        subject: 'ethics_management',
        severityScore: 2,
      },
    ],
  },
];

/* ─── Debug mock data: Agent 2 ─── */

const MOCK_PRECEDENTS: PrecedentsData = {
  cases: [
    {
      company: 'Johnson & Johnson',
      year: '1982',
      crisis: 'Tylenol Tampering Crisis',
      crisisType: 'Product Safety',
      strategy: 'Full Transparency + Immediate Recall',
      outcome: 'positive',
      outcomeLabel: 'Market share recovered within 1 year',
      lesson:
        'Immediate recall and transparent communication established the gold standard for crisis response. Consumer trust was rebuilt through decisive, costly action that prioritized safety over short-term profits.',
      articles: [
        { publisher: 'Washington Post', title: 'J&J Pulls All Tylenol From Shelves Nationwide', date: 'Oct 5, 1982', url: '' },
        { publisher: 'TIME', title: 'How Johnson & Johnson Saved Tylenol and Its Reputation', date: 'Oct 18, 1982', url: '' },
      ],
    },
    {
      company: 'Volkswagen',
      year: '2015',
      crisis: 'Emissions Scandal (Dieselgate)',
      crisisType: 'Regulatory & Governance',
      strategy: 'Initial Denial → Forced Admission',
      outcome: 'negative',
      outcomeLabel: '$30B+ in fines, CEO resigned',
      lesson:
        'Denial of factual evidence destroyed credibility with regulators and the public alike. Proactive disclosure before external investigation would have significantly limited financial and reputational damage.',
      articles: [
        { publisher: 'Reuters', title: 'VW Admits to Cheating U.S. Vehicle Emissions Tests', date: 'Sep 21, 2015', url: '' },
        { publisher: 'Bloomberg', title: 'Volkswagen CEO Winterkorn Resigns Over Emissions Scandal', date: 'Sep 23, 2015', url: '' },
      ],
    },
    {
      company: 'Equifax',
      year: '2017',
      crisis: 'Massive Data Breach',
      crisisType: 'Data & Privacy',
      strategy: 'Delayed Response → Forced Transparency',
      outcome: 'negative',
      outcomeLabel: 'Stock dropped 35%, $700M settlement',
      lesson:
        'Six weeks of silence amplified public outrage exponentially. When the breach surfaced, the absence of a prepared response plan made the company appear negligent rather than victimized.',
      articles: [
        { publisher: 'The New York Times', title: 'Equifax Says Cyberattack May Have Affected 143 Million', date: 'Sep 7, 2017', url: '' },
        { publisher: 'The Wall Street Journal', title: 'Equifax Breach Could Be Most Costly in Corporate History', date: 'Sep 12, 2017', url: '' },
      ],
    },
    {
      company: 'Starbucks',
      year: '2018',
      crisis: 'Racial Bias Incident',
      crisisType: 'Reputation & Social',
      strategy: 'Own It + Systemic Action',
      outcome: 'positive',
      outcomeLabel: 'Brand sentiment recovered in 3 months',
      lesson:
        'Closing 8,000 stores for racial bias training demonstrated commitment beyond words. The structural response — accepting material cost — outperformed any PR statement alone.',
      articles: [
        { publisher: 'CNN', title: 'Starbucks to Close All Stores for Racial-Bias Training', date: 'Apr 17, 2018', url: '' },
        { publisher: 'The Guardian', title: 'Starbucks Anti-Bias Training: What Happened and What It Means', date: 'May 30, 2018', url: '' },
      ],
    },
  ],
  globalLesson: 'Companies that responded within 48 hours with full transparency recovered 3x faster than those that delayed or denied.',
  confidence: 'high',
};

/* ─── Debug mock data: Agent 4 ─── */

const MOCK_STRATEGY_DATA: StrategyData = {
  alertLevel: 'MEDIUM',
  alertReasoning: 'Moderate reach with significant churn risk warrants a proactive but measured response.',
  recommendedAction: 'communicate',
  strategies: [
    {
      name: 'Offensive',
      description: 'Legal-focused, firm tone. Aggressively correct misinformation and pursue cease-and-desist where applicable. High cost, slower ROI but protects legal standing.',
      tone: 'Firm & Legal',
      channels: ['press_release', 'legal_notice', 'internal_email'],
      keyActions: [
        'Issue cease-and-desist to publications with factual errors',
        'Engage external legal counsel for defamation review',
        'Prepare formal rebuttal with documented evidence',
        'Brief board on legal strategy and timeline',
      ],
      estimatedCostEur: 85000,
      estimatedImpact: 'Reduces VaR by ~25%, high legal risk if facts are contested',
      roiScore: 4,
    },
    {
      name: 'Diplomate',
      description: 'Empathy and transparency combined with factual corrections. Balanced cost with proactive communication to rebuild trust. Includes commercial gestures if churn risk is high.',
      tone: 'Empathetic & Transparent',
      channels: ['press_release', 'social_media', 'internal_email', 'stakeholder_email'],
      keyActions: [
        'Publish transparent statement acknowledging concerns',
        'Launch proactive customer communication program',
        'Offer goodwill gestures to affected customers',
        'Host open Q&A session with leadership',
        'Commit to weekly progress updates',
      ],
      estimatedCostEur: 45000,
      estimatedImpact: 'Reduces VaR by ~55%, rebuilds trust within 2-4 weeks',
      roiScore: 8,
    },
    {
      name: 'Silence',
      description: 'Minimize the Streisand effect by avoiding public response. Handle concerns privately through direct channels. Minimal cost but risks appearing dismissive.',
      tone: 'Minimal & Observant',
      channels: ['internal_email'],
      keyActions: [
        'Monitor media coverage without public response',
        'Prepare holding statement for media inquiries only',
        'Handle customer complaints through private channels',
        'Brief internal teams on no-comment protocol',
      ],
      estimatedCostEur: 5000,
      estimatedImpact: 'No immediate VaR reduction, relies on news cycle fading naturally',
      roiScore: 5,
    },
  ],
  recommendedStrategy: 'Diplomate',
  recommendationReasoning: 'Given moderate churn risk and established media coverage, a transparent and empathetic approach maximizes ROI while minimizing legal exposure.',
  drafts: {
    pressRelease: 'FOR IMMEDIATE RELEASE\n\nCompany Statement Regarding Recent Concerns\n\nWe take full responsibility for this situation and are committed to complete transparency with our stakeholders, customers, and the public.\n\n"We recognize the severity of this matter and the trust our customers have placed in us," said company leadership. "We are implementing immediate corrective measures and will provide regular updates as our internal review progresses."\n\nImmediate actions being taken:\n  • Independent third-party review initiated\n  • Dedicated response team established\n  • Direct stakeholder communication program launched\n  • Regular progress updates committed to weekly cadence\n\nMedia Contact: press@company.com',
    internalEmail: 'INTERNAL — CONFIDENTIAL\n\nTo: All Employees\nFrom: Office of the CEO\nRe: Our Path Forward\n\nTeam,\n\nI\'m writing to address the situation directly. You may have seen recent coverage, and I want you to hear it from me first.\n\nWe are taking immediate action:\n1. Full internal audit launching today\n2. External advisory board being assembled this week\n3. Every affected stakeholder will receive direct communication\n4. Weekly all-hands updates until this is fully resolved\n\nI need each of you to uphold our values in every conversation. My door is open.',
    socialPost: 'We\'ve heard your concerns and we\'re taking action. Full transparency, immediate corrective measures, and weekly updates. Your trust matters — we intend to earn it back through action. More details: [link]',
    legalNotice: '',
  },
  decisionSummary: 'With a total VaR of €45,200 and moderate media reach, this crisis warrants active management. Historical precedents show that transparent, proactive responses in similar situations recovered trust 3x faster. The Diplomate strategy offers the best ROI at 8/10, balancing cost efficiency with trust recovery speed.',
};

/* ─── Debug mock data: Agent 5 ─── */

const MOCK_INVOICE_DATA: InvoiceData = {
  lineItems: [
    {
      agent: 'Historical Strategist',
      event: 'historical_precedents_extracted',
      humanEquivalentValueEur: 1800,
      apiComputeCostEur: 0.122,
      grossMarginPercent: 99.99,
      detail: '4 cases \u00d7 3h \u00d7 \u20ac150/h',
    },
    {
      agent: 'Risk Analyst',
      event: 'risk_assessment_completed',
      humanEquivalentValueEur: 504.52,
      apiComputeCostEur: 0.048,
      grossMarginPercent: 99.99,
      detail: '\u20ac500 base + 0.01% of \u20ac45,200 VaR',
    },
    {
      agent: 'Executive Strategist',
      event: 'crisis_strategy_delivered',
      humanEquivalentValueEur: 2500,
      apiComputeCostEur: 0.02,
      grossMarginPercent: 99.99,
      detail: 'Full crisis mitigation plan (fixed fee)',
    },
  ],
  totalHumanEquivalentEur: 4804.52,
  totalApiCostEur: 0.19,
  totalGrossMarginPercent: 99.99,
  roiMultiplier: 25287,
  invoiceSummary: 'Crisis response delivered for \u20ac0.19 in API costs \u2014 equivalent to \u20ac4,804.52 in traditional consulting fees (25,287\u00d7 ROI).',
  tradeOffReasoning: 'A traditional PR agency would charge \u20ac4,804.52 for this level of crisis response: \u20ac1,800.00 for precedent research (12h of analyst work), \u20ac504.52 for financial risk assessment, and \u20ac2,500.00 for strategy development with communication drafts. Our AI agents delivered identical outputs in under 60 seconds at 99.99% gross margin, saving the client \u20ac4,804.33.',
  actionRefused: false,
  refusalReason: '',
};

/** Debug mode: add ?debug to the URL to skip the backend and use mock data */
const isDebug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

/* ─── API calls ─── */

export async function searchCompany(companyName: string): Promise<TopicGroup[]> {
  if (isDebug) {
    // Simulate network delay then return mock data
    await new Promise((r) => setTimeout(r, 2500));
    console.log(`[DEBUG MODE] Returning mock data for "${companyName}"`);
    return MOCK_TOPICS;
  }

  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ company_name: companyName }),
  });

  if (!res.ok) {
    throw new Error(`Search failed: ${res.status} ${res.statusText}`);
  }

  const data: SearchResponse = await res.json();
  return transformSubjects(data.subjects);
}

export async function fetchPrecedents(companyName: string, topic: TopicGroup): Promise<PrecedentsData> {
  if (isDebug) {
    await new Promise((r) => setTimeout(r, 4000));
    console.log(`[DEBUG MODE] Returning mock precedents for "${topic.name}"`);
    return MOCK_PRECEDENTS;
  }

  const res = await fetch('/api/precedents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_name: companyName,
      topic_name: topic.name,
      topic_summary: topic.summary,
      articles: topic.articles.map((a) => ({
        title: a.title,
        summary: a.summary,
        subject: a.subject,
        severity_score: a.severityScore,
      })),
    }),
  });

  if (!res.ok) {
    throw new Error(`Precedents search failed: ${res.status} ${res.statusText}`);
  }

  const data: PrecedentsResponse = await res.json();
  return transformPrecedents(data);
}

export async function fetchCrisisResponse(
  companyName: string,
  topic: TopicGroup,
): Promise<{ strategyData: StrategyData; precedentsData: PrecedentsData; invoiceData: InvoiceData | null }> {
  if (isDebug) {
    await new Promise((r) => setTimeout(r, 5000));
    console.log(`[DEBUG MODE] Returning mock crisis response for "${topic.name}"`);
    return { strategyData: MOCK_STRATEGY_DATA, precedentsData: MOCK_PRECEDENTS, invoiceData: MOCK_INVOICE_DATA };
  }

  const res = await fetch('/api/crisis-response', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_name: companyName,
      topic_name: topic.name,
      topic_summary: topic.summary,
      articles: topic.articles.map((a) => ({
        title: a.title,
        summary: a.summary,
        subject: a.subject,
        severity_score: a.severityScore,
      })),
    }),
  });

  if (!res.ok) {
    throw new Error(`Crisis response failed: ${res.status} ${res.statusText}`);
  }

  const data: CrisisResponseResponse = await res.json();
  return {
    strategyData: transformStrategyReport(data),
    precedentsData: transformPrecedents({
      precedents: data.precedents,
      global_lesson: data.global_lesson,
      confidence: data.confidence,
    }),
    invoiceData: data.invoice ? transformInvoice(data.invoice) : null,
  };
}
