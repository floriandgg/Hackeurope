/**
 * Pre-cached demo data for 3 showcase companies.
 *
 * Raw JSON files are captured by `scripts/capture-demo-data.py` and stored in
 * `frontend/src/data/raw/`. This module imports them at build time and
 * transforms them using the same functions the live API path uses.
 */

import {
  transformSubjects,
  transformStrategyReport,
  transformPrecedents,
  transformInvoice,
  type TopicGroup,
  type StrategyData,
  type PrecedentsData,
  type InvoiceData,
  type SearchResponse,
  type CrisisResponseResponse,
} from '../api';

/* ─── Raw JSON imports ─── */

import openaiSearch from './raw/openai-search.json';
import teslaSearch from './raw/tesla-search.json';

// OpenAI crisis responses (one per topic — we import as many as exist)
const openaiCrisisModules = import.meta.glob('./raw/openai-topic-*-crisis.json', { eager: true });
// Tesla crisis responses
const teslaCrisisModules = import.meta.glob('./raw/tesla-topic-*-crisis.json', { eager: true });

/* ─── Types ─── */

export type DemoTopicData = {
  strategyData: StrategyData;
  precedentsData: PrecedentsData;
  invoiceData: InvoiceData | null;
};

export type DemoCompanyData = {
  companyName: string;
  topicGroups: TopicGroup[];
  topicResponses: Record<string, DemoTopicData>;
};

/* ─── Helpers ─── */

function sortedCrisisModules(
  modules: Record<string, unknown>,
): CrisisResponseResponse[] {
  // Keys look like "./raw/openai-topic-0-crisis.json", "./raw/openai-topic-1-crisis.json"
  // Sort by the topic index number
  const sorted = Object.entries(modules).sort(([a], [b]) => {
    const numA = parseInt(a.match(/topic-(\d+)/)?.[1] ?? '0', 10);
    const numB = parseInt(b.match(/topic-(\d+)/)?.[1] ?? '0', 10);
    return numA - numB;
  });
  return sorted.map(([, mod]) => (mod as { default: CrisisResponseResponse }).default);
}

function buildCompanyData(
  companyName: string,
  searchJson: SearchResponse,
  crisisModules: Record<string, unknown>,
): DemoCompanyData {
  const topicGroups = transformSubjects(searchJson.subjects);
  const crisisResponses = sortedCrisisModules(crisisModules);

  const topicResponses: Record<string, DemoTopicData> = {};
  topicGroups.forEach((topic, i) => {
    const crisis = crisisResponses[i];
    if (!crisis) return;

    topicResponses[topic.name] = {
      strategyData: transformStrategyReport(crisis),
      precedentsData: transformPrecedents({
        precedents: crisis.precedents,
        global_lesson: crisis.global_lesson,
        confidence: crisis.confidence,
      }),
      invoiceData: crisis.invoice ? transformInvoice(crisis.invoice) : null,
    };
  });

  return { companyName, topicGroups, topicResponses };
}

/* ─── Exported demo data ─── */

export const DEMO_DATA: Record<string, DemoCompanyData> = {
  openai: buildCompanyData('OpenAI', openaiSearch as SearchResponse, openaiCrisisModules),
  tesla: buildCompanyData('Tesla', teslaSearch as SearchResponse, teslaCrisisModules),
};
