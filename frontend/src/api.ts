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
}

export interface TopicGroup {
  name: string;
  summary: string;
  articles: Article[];
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

/* ─── Transform ─── */

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
    })),
  }));
}

/* ─── Debug mock data ─── */

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
      },
      {
        publisher: 'TechCrunch',
        date: 'Feb 16, 2026',
        title: 'Product Safety Report Flags Critical Vulnerabilities',
        summary: 'Independent researchers identify multiple unpatched vulnerabilities in flagship product.',
        criticality: 8,
        url: 'https://techcrunch.com/example',
      },
      {
        publisher: 'Wired',
        date: 'Feb 12, 2026',
        title: 'AI Ethics Board Resignations Signal Internal Discord',
        summary: 'Three board members step down over disagreements about AI deployment policies.',
        criticality: 6,
        url: 'https://wired.com/example',
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
      },
      {
        publisher: 'The Wall Street Journal',
        date: 'Feb 17, 2026',
        title: 'Executive Leadership Shakeup Raises Governance Questions',
        summary: 'Departure of two C-suite executives prompts investor concerns about stability.',
        criticality: 8,
        url: 'https://wsj.com/example',
      },
      {
        publisher: 'Bloomberg',
        date: 'Feb 15, 2026',
        title: 'Quarterly Earnings Fall Short of Projections',
        summary: 'Revenue missed consensus by 12%, marking the third disappointing quarter.',
        criticality: 7,
        url: 'https://bloomberg.com/example',
      },
      {
        publisher: 'Associated Press',
        date: 'Feb 14, 2026',
        title: 'Employee Whistleblower Alleges Safety Issues',
        summary: 'Former employee files complaint citing OSHA violations and management negligence.',
        criticality: 7,
        url: 'https://apnews.com/example',
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
      },
      {
        publisher: 'CNBC',
        date: 'Feb 11, 2026',
        title: 'Supply Chain Disruptions Threaten Product Launch',
        summary: 'Key supplier bankruptcy creates uncertainty for product availability.',
        criticality: 5,
        url: 'https://cnbc.com/example',
      },
      {
        publisher: 'The New York Times',
        date: 'Feb 10, 2026',
        title: 'Consumer Backlash Over Pricing Changes',
        summary: 'Petition with 200K signatures demands reversal of recent price increases.',
        criticality: 5,
        url: 'https://nytimes.com/example',
      },
    ],
  },
];

/** Debug mode: add ?debug to the URL to skip the backend and use mock data */
const isDebug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

/* ─── API call ─── */

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
