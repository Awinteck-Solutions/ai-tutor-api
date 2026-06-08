import { createHash } from "crypto";
import { env } from "../../config/env";
import {
  isCloudflareApiTokenValue,
  resolveR2TokenAccessKeyId,
} from "./r2.token-resolver";

export type R2AuthMode =
  | "s3_keys"
  | "r2_api_token_s3"
  | "bearer"
  | "none";

export interface R2S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
}

function sha256Secret(tokenValue: string): string {
  return createHash("sha256").update(tokenValue, "utf8").digest("hex");
}

function looksLikeS3Secret(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (isCloudflareApiTokenValue(v)) return false;
  return true;
}

/**
 * How this app authenticates to R2:
 *
 * 1. **R2 API token (cfat_/cfut_)** — value from R2 → Manage API Tokens:
 *    R2_ACCOUNT_ID + R2_API_TOKEN (+ optional R2_ACCESS_KEY_ID = Access Key ID)
 *    S3 secret = SHA-256(token value). Access Key ID auto-fetched via verify if omitted.
 *
 * 2. **S3 keys** — Access Key ID + Secret Access Key from the same screen (not cfat_):
 *    R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY
 *
 * 3. **Bearer** — legacy Profile API tokens (unprefixed) for REST upload only
 */
export function resolveR2AuthMode(): R2AuthMode {
  const { accountId, accessKeyId, secretAccessKey, apiToken } = env.r2;

  if (!accountId) return "none";

  if (
    accessKeyId &&
    secretAccessKey &&
    looksLikeS3Secret(secretAccessKey)
  ) {
    return "s3_keys";
  }

  if (apiToken && isCloudflareApiTokenValue(apiToken)) {
    return "r2_api_token_s3";
  }

  if (apiToken && (accessKeyId || env.r2.apiTokenId)) {
    return "r2_api_token_s3";
  }

  if (apiToken) return "bearer";

  return "none";
}

export function resolveR2S3CredentialsSync(): R2S3Credentials | null {
  const { accessKeyId, secretAccessKey, apiTokenId, apiToken } = env.r2;

  if (
    accessKeyId &&
    secretAccessKey &&
    looksLikeS3Secret(secretAccessKey)
  ) {
    return { accessKeyId, secretAccessKey };
  }

  const keyId = accessKeyId || apiTokenId;
  if (apiToken && keyId) {
    return {
      accessKeyId: keyId,
      secretAccessKey: sha256Secret(apiToken),
    };
  }

  return null;
}

export async function resolveR2S3Credentials(): Promise<R2S3Credentials | null> {
  const sync = resolveR2S3CredentialsSync();
  if (sync) return sync;

  const { apiToken } = env.r2;
  if (!apiToken || !isCloudflareApiTokenValue(apiToken)) return null;

  const keyId = await resolveR2TokenAccessKeyId();
  if (!keyId) return null;

  return {
    accessKeyId: keyId,
    secretAccessKey: sha256Secret(apiToken),
  };
}

export function describeR2Config(): {
  configured: boolean;
  mode: R2AuthMode;
  accountId: boolean;
  bucketName: string;
  hint?: string;
} {
  const mode = resolveR2AuthMode();
  const { accountId, apiToken, secretAccessKey, bucketName } = env.r2;

  if (apiToken && isCloudflareApiTokenValue(apiToken)) {
    if (secretAccessKey && secretAccessKey === apiToken) {
      return {
        configured: mode !== "none",
        mode,
        accountId: Boolean(accountId),
        bucketName,
        hint:
          "Remove R2_SECRET_ACCESS_KEY — the cfat_/cfut_ value belongs only in R2_API_TOKEN. " +
          "Optionally set R2_ACCESS_KEY_ID to the Access Key ID shown when the token was created.",
      };
    }
  }

  if (mode === "none") {
    let hint =
      "Set R2_ACCOUNT_ID and R2_API_TOKEN (from R2 → Manage API Tokens).";
    if (accountId && !apiToken) {
      hint =
        "Set R2_API_TOKEN to the token value shown once at creation (starts with cfat_ or cfut_).";
    }
    return {
      configured: false,
      mode: "none",
      accountId: Boolean(accountId),
      bucketName,
      hint,
    };
  }

  return {
    configured: true,
    mode,
    accountId: true,
    bucketName,
  };
}
