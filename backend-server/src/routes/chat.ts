import { Router } from "express";
import { z } from "zod";
import { DOCUMENT_CATEGORIES } from "../categories";
import { asyncHandler } from "../lib/http";
import { config } from "../config";
import { runAgenticRetrieval } from "../services/agent/run";
import { embedTexts } from "../services/embeddingClient";
import { generateAnswer } from "../services/llm";
import { retrieve } from "../services/retrieval";

const chatSchema = z.object({
  question: z.string().trim().min(1, "Enter a question.").max(2000, "Question must be 2000 characters or fewer."),
  documentIds: z.array(z.string().uuid()).max(50).optional(),
  categories: z.array(z.enum(DOCUMENT_CATEGORIES)).max(DOCUMENT_CATEGORIES.length).optional(),
});

export const chatRouter = Router();

chatRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = chatSchema.parse(req.body);
    const documentIds = body.documentIds ?? [];
    const categories = body.categories ?? [];
    const retrieved = config.agentEnabled
      ? await runAgenticRetrieval({ question: body.question, documentIds, categories })
      : { citations: await retrieveDirect(body.question, documentIds, categories), agent: null };

    if (retrieved.citations.length === 0) {
      const scope = categories.length > 0 ? " in the selected categories" : "";
      res.json({
        answer: `No indexed passages${scope} matched this question. A ready document in that scope is required before search can return passages.`,
        citations: [],
        model: null,
        agent: retrieved.agent,
      });
      return;
    }

    try {
      const generated = await generateAnswer(body.question, retrieved.citations);
      res.json({ answer: generated.text, citations: retrieved.citations, model: generated.model, agent: retrieved.agent });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Language model request failed";
      res.json({
        answer: `Retrieved ${retrieved.citations.length} relevant passage${retrieved.citations.length === 1 ? "" : "s"}, but the language model could not be reached (${message}). The citations below are the closest matching text. Check LLM_BASE_URL, LLM_MODEL, and LLM_API_KEY.`,
        citations: retrieved.citations,
        model: null,
        agent: retrieved.agent,
      });
    }
  })
);

async function retrieveDirect(question: string, documentIds: string[], categories: string[]) {
  let queryEmbedding: number[] | null = null;
  try {
    const [vector] = await embedTexts([question]);
    queryEmbedding = vector ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Embedding request failed";
    console.error(`[chat] embedding failed; continuing with keyword search: ${message}`);
  }
  return retrieve(question, queryEmbedding, { documentIds, categories });
}
