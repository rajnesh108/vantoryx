import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/http";
import { embedTexts } from "../services/embeddingClient";
import { generateAnswer } from "../services/llm";
import { searchSimilar } from "../services/retrieval";

const chatSchema = z.object({
  question: z.string().trim().min(1, "Enter a question.").max(2000, "Question must be 2000 characters or fewer."),
  documentIds: z.array(z.string().uuid()).max(50).optional(),
});

export const chatRouter = Router();

chatRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = chatSchema.parse(req.body);
    const documentIds = body.documentIds ?? [];
    const [queryEmbedding] = await embedTexts([body.question]);
    const citations = await searchSimilar(queryEmbedding, documentIds);

    if (citations.length === 0) {
      res.json({
        answer: "No indexed passages matched this question. Upload a text-based PDF and wait until it is ready.",
        citations: [],
        model: null,
      });
      return;
    }

    try {
      const generated = await generateAnswer(body.question, citations);
      res.json({ answer: generated.text, citations, model: generated.model });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Language model request failed";
      res.json({
        answer: `Retrieved ${citations.length} relevant passage${citations.length === 1 ? "" : "s"}, but the language model could not be reached (${message}). The citations below are the closest matching text. Check LLM_BASE_URL, LLM_MODEL, and LLM_API_KEY.`,
        citations,
        model: null,
      });
    }
  })
);
