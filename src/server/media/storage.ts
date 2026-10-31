import "server-only";
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cliente de Cloudflare R2 (API S3). En desarrollo, `R2_ENDPOINT` apunta a MinIO local (path-style).
 * Credenciales solo por variables de entorno: ver `docs/r2-setup.md`.
 */

const PRESIGN_TTL_S = 5 * 60;

type R2Config = { bucket: string; publicBaseUrl: string; client: S3Client };
let cached: R2Config | null = null;

const REQUIRED = ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE_URL"] as const;

/** `true` si están todas las variables necesarias (para mostrar un error claro en vez de un 500). */
export function isStorageConfigured(): boolean {
  return REQUIRED.every((k) => !!process.env[k]) && (!!process.env.R2_ENDPOINT || !!process.env.R2_ACCOUNT_ID);
}

function config(): R2Config {
  if (cached) return cached;
  if (!isStorageConfigured()) throw new Error("R2 storage is not configured (missing R2_* env vars)");
  const env = process.env;
  const endpoint = env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const client = new S3Client({
    region: "auto",
    endpoint,
    forcePathStyle: !!env.R2_ENDPOINT,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY! },
  });
  cached = { bucket: env.R2_BUCKET!, publicBaseUrl: env.R2_PUBLIC_BASE_URL!, client };
  return cached;
}

/** Base pública de lectura (`R2_PUBLIC_BASE_URL`), p. ej. `https://media.elbravo.app`. */
export function publicBaseUrl(): string {
  return config().publicBaseUrl;
}

/** URL prefirmada para un `PUT` directo desde el navegador. Vence en 5 minutos. */
export async function presignPut(key: string, contentType: string): Promise<string> {
  const { client, bucket } = config();
  return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), {
    expiresIn: PRESIGN_TTL_S,
  });
}

function isNotFound(e: unknown) {
  if (e instanceof S3ServiceException) return e.$metadata?.httpStatusCode === 404 || e.name === "NotFound";
  const name = (e as { name?: unknown } | null)?.name;
  return name === "NotFound" || name === "NoSuchKey";
}

export async function headObject(key: string): Promise<{ size: number; contentType: string } | null> {
  const { client, bucket } = config();
  try {
    const r = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { size: r.ContentLength ?? 0, contentType: r.ContentType ?? "application/octet-stream" };
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

/** Idempotente: borrar una key inexistente no falla. */
export async function deleteObject(key: string): Promise<void> {
  const { client, bucket } = config();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** Subida desde el server (script de migración). */
export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const { client, bucket } = config();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
}
