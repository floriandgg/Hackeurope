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
interface SearchResponse {
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

function transformSubjects(subjects: BackendSubject[]): TopicGroup[] {
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

function transformPrecedents(data: PrecedentsResponse): PrecedentsData {
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
