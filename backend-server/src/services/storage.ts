import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { config } from "../config";

const PDF_HEADER = "%PDF-";

export function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, PDF_HEADER.length).toString("utf8") === PDF_HEADER;
}

export async function ensureUploadDir(): Promise<void> {
  await fs.promises.mkdir(config.uploadDir, { recursive: true });
}

export async function savePdf(originalName: string, buffer: Buffer): Promise<{
  id: string;
  originalName: string;
  storagePath: string;
}> {
  await ensureUploadDir();
  const id = randomUUID();
  const base = path.basename(originalName).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  const filename = `${id}-${base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`}`;
  const storagePath = path.join(config.uploadDir, filename);
  await fs.promises.writeFile(storagePath, buffer);
  return { id, originalName: path.basename(originalName), storagePath };
}

export async function removeFile(storagePath: string): Promise<void> {
  await fs.promises.unlink(storagePath).catch(() => undefined);
}
