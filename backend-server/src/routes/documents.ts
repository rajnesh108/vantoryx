import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireUser } from "../auth/session";
import { isDocumentCategory } from "../categories";
import { deleteDocument, getDocument, getStoragePath, insertDocument, listDocuments } from "../db/documents";
import { asyncHandler, HttpError } from "../lib/http";
import { ingestDocument } from "../services/ingestion";
import { isPdf, removeFile, savePdf } from "../services/storage";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024, files: 1 },
});

const idSchema = z.string().uuid();

export const documentsRouter = Router();

documentsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await listDocuments());
  })
);

documentsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const document = await getDocument(id);
    if (!document) throw new HttpError(404, "Document not found");
    res.json(document);
  })
);

documentsRouter.post(
  "/",
  asyncHandler(async (req, _res, next) => {
    await requireUser(req);
    next();
  }),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, "Choose a PDF to upload.");
    if (!isPdf(req.file.buffer)) throw new HttpError(400, "Only PDF files are supported.");
    const category = typeof req.body.category === "string" ? req.body.category : "";
    if (!isDocumentCategory(category)) throw new HttpError(400, "Choose a document category.");

    const saved = await savePdf(req.file.originalname, req.file.buffer);
    try {
      const document = await insertDocument({ ...saved, category });
      void ingestDocument(document.id);
      res.status(202).json(document);
    } catch (error) {
      await removeFile(saved.storagePath);
      throw error;
    }
  })
);

documentsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await requireUser(req);
    const id = idSchema.parse(req.params.id);
    const storagePath = await getStoragePath(id);
    if (!storagePath) throw new HttpError(404, "Document not found");
    await deleteDocument(id);
    await removeFile(storagePath);
    res.status(204).send();
  })
);
