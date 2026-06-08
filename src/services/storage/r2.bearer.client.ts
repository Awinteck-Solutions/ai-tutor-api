import { env } from "../../config/env";
import { AppError } from "../../shared/errors/AppError";

const API_BASE = "https://api.cloudflare.com/client/v4";

/** Encode key for URL path; slashes stay literal per Cloudflare API rules. */
function objectKeyPath(key: string): string {
  return key.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function objectsUrl(objectKey: string): string {
  const bucket = env.r2.bucketName;
  const accountId = env.r2.accountId;
  return `${API_BASE}/accounts/${accountId}/r2/buckets/${bucket}/objects/${objectKeyPath(objectKey)}`;
}

async function parseApiError(res: Response, action: string): Promise<never> {
  let detail = res.statusText;
  try {
    const json = (await res.json()) as {
      errors?: { message?: string }[];
    };
    detail = json.errors?.[0]?.message ?? detail;
  } catch {
    // ignore
  }

  if (res.status === 401 || res.status === 403) {
    throw new AppError(
      `Cloudflare R2 ${action} failed: API token rejected (${res.status})${detail ? `: ${detail}` : ""}. ` +
        "If your token starts with cfat_ or cfut_, use only R2_API_TOKEN (S3 mode) — do not use Bearer. " +
        "Create the token under R2 → Manage API Tokens with Object Read & Write on this bucket.",
      503
    );
  }

  throw new AppError(`Cloudflare R2 ${action} failed: ${detail}`, 503);
}

export class R2BearerClient {
  static isAvailable(): boolean {
    return Boolean(env.r2.accountId && env.r2.apiToken);
  }

  static async upload(
    key: string,
    body: Buffer,
    contentType: string
  ): Promise<{ key: string; url: string }> {
    const res = await fetch(objectsUrl(key), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${env.r2.apiToken}`,
        "Content-Type": contentType,
      },
      body: new Uint8Array(body),
    });

    if (!res.ok) await parseApiError(res, "upload");

    const url = env.r2.publicUrl
      ? `${env.r2.publicUrl}/${key}`
      : key;

    return { key, url };
  }

  static async download(key: string): Promise<Buffer> {
    const res = await fetch(objectsUrl(key), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.r2.apiToken}`,
      },
    });

    if (!res.ok) await parseApiError(res, "download");

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  static async delete(key: string): Promise<void> {
    const res = await fetch(objectsUrl(key), {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${env.r2.apiToken}`,
      },
    });

    if (!res.ok) await parseApiError(res, "delete");
  }
}
