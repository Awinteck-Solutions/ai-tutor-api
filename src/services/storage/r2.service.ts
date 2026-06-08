import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors/AppError";
import { R2BearerClient } from "./r2.bearer.client";
import {
  describeR2Config,
  resolveR2AuthMode,
  resolveR2S3Credentials,
} from "./r2.credentials";

function isR2AuthError(err: unknown): boolean {
  const e = err as {
    Code?: string;
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    e?.Code === "Unauthorized" ||
    e?.name === "Unauthorized" ||
    e?.$metadata?.httpStatusCode === 401 ||
    e?.$metadata?.httpStatusCode === 403
  );
}

function wrapS3Error(err: unknown, action: string): never {
  if (err instanceof AppError) throw err;

  const mode = resolveR2AuthMode();
  if (isR2AuthError(err)) {
    const hint =
      mode === "r2_api_token_s3"
        ? "Check R2_API_TOKEN (cfat_/cfut_ value) and that the token has Object Read & Write on bucket \"" +
          env.r2.bucketName +
          "\". Optionally set R2_ACCESS_KEY_ID from the Access Key ID shown at token creation."
        : "Check R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY from R2 → Manage API Tokens.";
    throw new AppError(
      `Cloudflare R2 ${action} failed: invalid credentials (401/403). ${hint}`,
      503
    );
  }

  const message = err instanceof Error ? err.message : String(err);
  throw new AppError(`Cloudflare R2 ${action} failed: ${message}`, 503);
}

async function createS3Client(): Promise<S3Client | null> {
  const creds = await resolveR2S3Credentials();
  if (!creds || !env.r2.accountId) return null;

  return new S3Client({
    region: "auto",
    endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
    },
  });
}

export class R2StorageService {
  private static s3Client: S3Client | null = null;
  private static s3Init: Promise<S3Client | null> | null = null;

  private static useBearer(): boolean {
    return resolveR2AuthMode() === "bearer";
  }

  static async warmUp(): Promise<void> {
    const summary = describeR2Config();
    if (!summary.configured || this.useBearer()) return;

    await this.getS3Client();
  }

  private static async getS3Client(): Promise<S3Client | null> {
    if (this.useBearer()) return null;
    if (this.s3Client) return this.s3Client;
    if (!this.s3Init) {
      this.s3Init = createS3Client().then((client) => {
        this.s3Client = client;
        return client;
      });
    }
    return this.s3Init;
  }

  static isConfigured(): boolean {
    return describeR2Config().configured;
  }

  static configSummary() {
    return describeR2Config();
  }

  static async upload(
    key: string,
    body: Buffer,
    contentType: string
  ): Promise<{ key: string; url: string }> {
    if (!this.isConfigured()) {
      const summary = describeR2Config();
      throw new AppError(
        summary.hint ??
          "R2 storage is not configured. Set R2_ACCOUNT_ID and R2_API_TOKEN in api/.env",
        503
      );
    }

    if (this.useBearer()) {
      return R2BearerClient.upload(key, body, contentType);
    }

    const s3 = await this.getS3Client();
    if (!s3) {
      throw new AppError(
        "R2 S3 client is not configured. For cfat_/cfut_ tokens, ensure R2_ACCOUNT_ID matches the token account " +
          "or set R2_ACCESS_KEY_ID to the Access Key ID from token creation.",
        503
      );
    }

    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: env.r2.bucketName,
          Key: key,
          Body: body,
          ContentType: contentType,
        })
      );
    } catch (err) {
      wrapS3Error(err, "upload");
    }

    const url = env.r2.publicUrl
      ? `${env.r2.publicUrl}/${key}`
      : await this.getSignedUrl(key);

    return { key, url };
  }

  static async download(key: string): Promise<Buffer> {
    if (!this.isConfigured()) {
      throw new AppError("R2 storage is not configured", 503);
    }

    if (this.useBearer()) {
      return R2BearerClient.download(key);
    }

    const s3 = await this.getS3Client();
    if (!s3) {
      throw new AppError("R2 S3 client is not configured", 503);
    }

    try {
      const response = await s3.send(
        new GetObjectCommand({
          Bucket: env.r2.bucketName,
          Key: key,
        })
      );

      if (!response.Body) {
        throw new AppError("Empty file returned from storage", 500);
      }

      return this.streamToBuffer(response.Body as Readable);
    } catch (err) {
      wrapS3Error(err, "download");
    }
  }

  static async delete(key: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new AppError("R2 storage is not configured", 503);
    }

    if (this.useBearer()) {
      return R2BearerClient.delete(key);
    }

    const s3 = await this.getS3Client();
    if (!s3) {
      throw new AppError("R2 S3 client is not configured", 503);
    }

    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: env.r2.bucketName,
          Key: key,
        })
      );
    } catch (err) {
      wrapS3Error(err, "delete");
    }
  }

  static async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    if (this.useBearer()) {
      if (env.r2.publicUrl) {
        return `${env.r2.publicUrl}/${key}`;
      }
      throw new AppError(
        "PDF preview URLs require R2_PUBLIC_URL when using Bearer auth. " +
          "Enable public access on your bucket in Cloudflare R2 settings.",
        503
      );
    }

    const s3 = await this.getS3Client();
    if (!s3) {
      throw new AppError("R2 S3 client is not configured", 503);
    }

    try {
      return await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: env.r2.bucketName, Key: key }),
        { expiresIn }
      );
    } catch (err) {
      wrapS3Error(err, "sign URL");
    }
  }

  private static async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
