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

/* ─── API call ─── */

export async function searchCompany(companyName: string): Promise<TopicGroup[]> {
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
