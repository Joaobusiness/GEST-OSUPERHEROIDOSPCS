import "server-only";
import { createHash } from "node:crypto";

const cfg = () => {
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
  return cloud && key && secret ? { cloud, key, secret } : null;
};

export const cloudinaryEnabled = () => cfg() !== null;

/** Signed request: sha1 of the sorted params + secret (Cloudinary REST API). */
async function call(path: "upload" | "destroy", params: Record<string, string>, file?: string) {
  const c = cfg();
  if (!c) throw new Error("Cloudinary não configurado.");
  const signed = { ...params, timestamp: String(Math.floor(Date.now() / 1000)) };
  const signature = createHash("sha1")
    .update(Object.entries(signed).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join("&") + c.secret)
    .digest("hex");
  const body = new FormData();
  for (const [k, v] of Object.entries({ ...signed, api_key: c.key, signature })) body.set(k, v);
  if (file) body.set("file", file);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${c.cloud}/image/${path}`, { method: "POST", body, signal: AbortSignal.timeout(20_000) });
  const j = (await r.json().catch(() => ({}))) as { secure_url?: string; error?: { message?: string } };
  if (!r.ok) throw new Error(j.error?.message ?? `Cloudinary ${r.status}`);
  return j;
}

/** One logo per company: the same public_id is overwritten, so old files never pile up. */
const logoId = (tenantId: string) => `logos/${tenantId}`;

export async function uploadLogo(tenantId: string, dataUrl: string): Promise<string> {
  const j = await call("upload", { public_id: logoId(tenantId), overwrite: "true", invalidate: "true" }, dataUrl);
  if (!j.secure_url) throw new Error("Cloudinary não devolveu a URL.");
  return j.secure_url;
}

export async function deleteLogo(tenantId: string) {
  await call("destroy", { public_id: logoId(tenantId), invalidate: "true" });
}
