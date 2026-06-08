import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function fileFilter(allowed: Set<string>) {
  return (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (!allowed.has(file.mimetype)) {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  };
}

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: fileFilter(ALLOWED_MIME_TYPES),
});

export const pdfUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      cb(new Error("Only PDF files are allowed"));
      return;
    }
    cb(null, true);
  },
});

export function sanitizeFilename(originalName: string): string {
  const base = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.slice(0, 200) || "upload";
}

/** Human-readable title from an uploaded file name (strips extension). */
export function titleFromFilename(originalName: string): string {
  const base = path.basename(originalName);
  const withoutExt = base.replace(/\.[^/.]+$/, "");
  const cleaned = withoutExt.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 200) || "Untitled material";
}

export function generateFileKey(
  organizationId: string,
  originalName: string
): string {
  const ext = path.extname(sanitizeFilename(originalName));
  return `materials/${organizationId}/${uuidv4()}${ext}`;
}
