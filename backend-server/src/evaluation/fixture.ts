import { fuseByReciprocalRank } from "../services/fusion";
import type { SearchHit } from "../types";

export interface FixturePassage {
  chunkId: string;
  documentName: string;
  category: string;
  content: string;
}

export const FIXTURE_PASSAGES: FixturePassage[] = [
  {
    chunkId: "fixture-ipt-hiv",
    documentName: "fixture-tb-prevention.txt",
    category: "who",
    content:
      "Isoniazid preventive treatment for a six month course is the regimen this note lists for people living with HIV.",
  },
  {
    chunkId: "fixture-ipt-contacts",
    documentName: "fixture-tb-prevention.txt",
    category: "who",
    content:
      "Household contacts of a person with infectious tuberculosis are the second group this note lists for preventive treatment.",
  },
  {
    chunkId: "fixture-metformin",
    documentName: "fixture-diabetes.txt",
    category: "cdc",
    content: "Metformin is the first-line medicine this note names for type 2 diabetes.",
  },
  {
    chunkId: "fixture-overlap",
    documentName: "fixture-index.txt",
    category: "other",
    content:
      "Chunk overlap copies the tail of one passage onto the next so a sentence that crosses a boundary stays searchable.",
  },
];

const STOPWORDS = new Set([
  "the",
  "for",
  "and",
  "this",
  "that",
  "with",
  "from",
  "are",
  "was",
  "what",
  "does",
  "which",
  "note",
  "list",
  "listed",
  "lists",
  "how",
  "its",
  "who",
  "into",
  "onto",
  "has",
  "have",
  "not",
  "but",
  "can",
  "any",
]);

export function contentTerms(text: string): string[] {
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return [...new Set(tokens.filter((token) => token.length > 2 && !STOPWORDS.has(token)))];
}

export function rankFixture(query: string, passages: FixturePassage[] = FIXTURE_PASSAGES): SearchHit[] {
  const terms = contentTerms(query);
  if (terms.length === 0) return [];
  return passages
    .map((passage) => {
      const haystack = new Set(contentTerms(passage.content));
      const overlap = terms.filter((term) => haystack.has(term)).length;
      return { passage, overlap };
    })
    .filter((item) => item.overlap > 0)
    .sort((left, right) => right.overlap - left.overlap || left.passage.chunkId.localeCompare(right.passage.chunkId))
    .map((item) => toHit(item.passage, item.overlap / terms.length));
}

export function searchFixture(queries: string[], limit: number, passages: FixturePassage[] = FIXTURE_PASSAGES): SearchHit[] {
  const unique = [...new Set(queries.map((query) => query.trim()).filter(Boolean))];
  if (unique.length === 0 || limit < 1) return [];
  const lists = unique.map((query) => rankFixture(query, passages));
  return fuseByReciprocalRank(lists).slice(0, limit);
}

function toHit(passage: FixturePassage, score: number): SearchHit {
  return {
    chunkId: passage.chunkId,
    documentId: "fixture",
    documentName: passage.documentName,
    category: passage.category,
    pageStart: 1,
    pageEnd: 1,
    content: passage.content,
    score,
  };
}
