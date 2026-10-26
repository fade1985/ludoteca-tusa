// Utilidades compartidas por las funciones /api (los ficheros que empiezan por "_" no son rutas en Vercel)
import crypto from "node:crypto";

const R_URL = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
const R_TOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

export const HAS_REDIS = !!(R_URL && R_TOK);
export const HAS_IGDB = !!(process.env.IGDB_CLIENT_ID && process.env.IGDB_CLIENT_SECRET);
export const HAS_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
export const HAS_PASSWORD = !!process.env.EDIT_PASSWORD;
export const GAMES_KEY = "ludoteca:games";

export const features = () => ({ db: HAS_REDIS, igdb: HAS_IGDB, blob: HAS_BLOB, password: HAS_PASSWORD });

/* ---- Upstash Redis por REST (sin dependencias) ---- */
export async function redis(...cmd) {
  const r = await fetch(R_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${R_TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd.map(String)),
  });
  const d = await r.json().catch(() => ({ error: "Respuesta no válida de Redis" }));
  if (!r.ok || d.error) throw new Error(d.error || `Redis ${r.status}`);
  return d.result;
}

// Varios comandos de forma atómica (MULTI/EXEC)
export async function redisTx(cmds) {
  const r = await fetch(R_URL + "/multi-exec", {
    method: "POST",
    headers: { Authorization: `Bearer ${R_TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds.map((c) => c.map(String))),
  });
  const d = await r.json().catch(() => ({ error: "Respuesta no válida de Redis" }));
  if (!Array.isArray(d)) throw new Error(d.error || `Redis ${r.status}`);
  for (const x of d) if (x.error) throw new Error(x.error);
  return d.map((x) => x.result);
}

/* ---- Autenticación: una contraseña de edición en la variable EDIT_PASSWORD ---- */
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
export function isEditor(req) {
  const pw = process.env.EDIT_PASSWORD;
  const k = req.headers["x-ludoteca-key"];
  if (!pw || !k) return false;
  return crypto.timingSafeEqual(sha(k), sha(pw));
}

/* ---- Respuestas y cuerpos ---- */
export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

export async function rawBody(req, limit) {
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error("Archivo demasiado grande"), { status: 413 });
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

export async function jsonBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  const b = Buffer.isBuffer(req.body) ? req.body : typeof req.body === "string" ? Buffer.from(req.body) : await rawBody(req, 5e6);
  try { return JSON.parse(b.toString("utf8") || "null"); } catch { return null; }
}

export function query(req) {
  if (req.query) return req.query;
  return Object.fromEntries(new URL(req.url, "http://x").searchParams);
}
