import { env } from "../../config/env";

const API_BASE = "https://api.cloudflare.com/client/v4";
const CF_TOKEN_PREFIX = /^(cfat_|cfut_)/;

export function isCloudflareApiTokenValue(value: string): boolean {
  return CF_TOKEN_PREFIX.test(value.trim());
}

let cachedAccessKeyId: string | null = null;

/**
 * R2 S3 credentials from an Account/User API token (cfat_/cfut_):
 * - Access Key ID = token id (from verify or R2_ACCESS_KEY_ID / R2_API_TOKEN_ID)
 * - Secret Access Key = SHA-256 of the token value
 */
export async function resolveR2TokenAccessKeyId(): Promise<string | null> {
  const fromEnv =
    env.r2.accessKeyId || env.r2.apiTokenId;
  if (fromEnv) return fromEnv;

  if (cachedAccessKeyId) return cachedAccessKeyId;

  const token = env.r2.apiToken;
  if (!token || !env.r2.accountId) return null;

  const verifyUrl = isCloudflareApiTokenValue(token)
    ? `${API_BASE}/accounts/${env.r2.accountId}/tokens/verify`
    : `${API_BASE}/user/tokens/verify`;

  const res = await fetch(verifyUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;

  const json = (await res.json()) as {
    success?: boolean;
    result?: { id?: string };
  };

  const id = json.result?.id;
  if (id) cachedAccessKeyId = id;
  return id ?? null;
}
