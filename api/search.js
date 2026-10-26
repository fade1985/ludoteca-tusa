// GET /api/search?q=hades  → candidatos de IGDB con portada y ficha (requiere contraseña de edición)
import { HAS_IGDB, HAS_REDIS, redis, isEditor, send, query } from "./_lib.js";

const ID = process.env.IGDB_CLIENT_ID;
const SECRET = process.env.IGDB_CLIENT_SECRET;
const TOKEN_KEY = "ludoteca:igdb_token";
let token = null, tokenExp = 0;

async function getToken(force) {
  if (!force && token && Date.now() < tokenExp) return token;
  if (!force && HAS_REDIS) {
    const t = await redis("GET", TOKEN_KEY).catch(() => null);
    if (t) { token = t; tokenExp = Date.now() + 3600e3; return t; }
  }
  const r = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(ID)}&client_secret=${encodeURIComponent(SECRET)}&grant_type=client_credentials`, { method: "POST" });
  const d = await r.json();
  if (!d.access_token) throw new Error("No se pudo autenticar en Twitch/IGDB: revisa IGDB_CLIENT_ID e IGDB_CLIENT_SECRET");
  token = d.access_token;
  const ttl = Math.max(60, (d.expires_in || 3600) - 3600);
  tokenExp = Date.now() + ttl * 1000;
  if (HAS_REDIS) await redis("SET", TOKEN_KEY, token, "EX", ttl).catch(() => {});
  return token;
}

const FIELDS = [
  "name", "url", "summary", "first_release_date", "cover.image_id",
  "platforms.name", "platforms.abbreviation", "genres.name", "themes.name", "game_modes.name",
  "franchises.name", "collections.name",
  "involved_companies.developer", "involved_companies.publisher", "involved_companies.company.name",
].join(",");

async function igdb(body, retry = true) {
  const r = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: { "Client-ID": ID, Authorization: `Bearer ${await getToken(!retry)}`, Accept: "application/json", "Content-Type": "text/plain" },
    body,
  });
  if (r.status === 401 && retry) return igdb(body, false); // token caducado: se renueva
  if (!r.ok) throw new Error(`IGDB ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

function toResult(x, i) {
  const ic = x.involved_companies || [];
  const companies = (f) => [...new Set(ic.filter(f).map((c) => c.company?.name).filter(Boolean))].slice(0, 3).join(", ");
  const date = x.first_release_date ? new Date(x.first_release_date * 1000).toISOString().slice(0, 10) : "";
  const img = x.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${x.cover.image_id}.jpg` : "";
  const plats = x.platforms || [];
  // el tema "Action" lo tienen casi todos y taparía el género real, así que se omite
  const genre = [...(x.themes || []).filter((t) => t.name !== "Action"), ...(x.genres || [])].map((g) => g.name).join(", ");
  const sw = plats.some((p) => /switch/i.test(p.name || ""));
  return {
    id: x.id,
    name: x.name,
    year: date.slice(0, 4),
    platforms: plats.map((p) => p.abbreviation || p.name).slice(0, 6),
    switch: sw,
    cover: img,
    score: i - (sw ? 3 : 0) - (img ? 1 : 0),
    meta: {
      v4: true, src: "igdb", igdb: x.id, igdbUrl: x.url || "", img,
      desc: x.summary || "", lang: "en", date,
      dev: companies((c) => c.developer), pub: companies((c) => c.publisher),
      genre, series: (x.franchises?.[0] || x.collections?.[0])?.name || "",
      mode: (x.game_modes || []).map((m) => m.name).join(", "),
    },
  };
}

export default async function handler(req, res) {
  if (!HAS_IGDB) return send(res, 501, { error: "IGDB no configurado" });
  if (!isEditor(req)) return send(res, 401, { error: "Contraseña de edición incorrecta" });
  const q = String(query(req).q || "").replace(/["\\]/g, " ").trim().slice(0, 100);
  if (q.length < 2) return send(res, 400, { error: "Búsqueda demasiado corta" });
  const cacheKey = "ludoteca:search:" + q.toLowerCase();
  try {
    if (HAS_REDIS) {
      const c = await redis("GET", cacheKey).catch(() => null);
      if (c) return send(res, 200, { results: JSON.parse(c), cached: true });
    }
    const raw = await igdb(`search "${q}"; fields ${FIELDS}; where version_parent = null; limit 15;`);
    const results = raw.map(toResult).sort((a, b) => a.score - b.score).slice(0, 10).map(({ score, ...r }) => r);
    if (HAS_REDIS) await redis("SET", cacheKey, JSON.stringify(results), "EX", 86400).catch(() => {});
    return send(res, 200, { results });
  } catch (e) {
    console.error(e);
    return send(res, 502, { error: e.message });
  }
}
