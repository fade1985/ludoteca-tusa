// GET    /api/games            → lista completa (público)
// PUT    /api/games?id=XXX     → crea/actualiza un juego (requiere contraseña)
// DELETE /api/games?id=XXX     → elimina un juego (requiere contraseña)
// POST   /api/games            → carga masiva {games:[...], replace:true|false} (requiere contraseña)
import { HAS_REDIS, GAMES_KEY, features, redis, redisTx, isEditor, send, jsonBody, query } from "./_lib.js";

const MAX_GAME = 200_000; // bytes por juego (de sobra; una foto propia como dataURL cabe)

function clean(g) {
  if (!g || typeof g !== "object") return null;
  if (typeof g.id !== "string" || !/^[\w-]{1,40}$/.test(g.id)) return null;
  if (typeof g.title !== "string" || !g.title.trim() || g.title.length > 200) return null;
  if (g.platform !== "s1" && g.platform !== "s2") return null;
  const s = JSON.stringify(g);
  if (s.length > MAX_GAME) return null;
  return s;
}

export default async function handler(req, res) {
  if (!HAS_REDIS) return send(res, 503, { error: "Base de datos no configurada (Upstash Redis)", features: features() });
  try {
    if (req.method === "GET") {
      const flat = (await redis("HGETALL", GAMES_KEY)) || [];
      const games = [];
      for (let i = 0; i < flat.length; i += 2) { try { games.push(JSON.parse(flat[i + 1])); } catch {} }
      return send(res, 200, { games, features: features() });
    }

    if (!isEditor(req)) return send(res, 401, { error: "Contraseña de edición incorrecta" });

    if (req.method === "PUT") {
      const g = await jsonBody(req);
      const s = clean(g);
      if (!s || g.id !== query(req).id) return send(res, 400, { error: "Juego no válido" });
      await redis("HSET", GAMES_KEY, g.id, s);
      return send(res, 200, { ok: true });
    }

    if (req.method === "DELETE") {
      const id = query(req).id;
      if (!id) return send(res, 400, { error: "Falta id" });
      await redis("HDEL", GAMES_KEY, id);
      return send(res, 200, { ok: true });
    }

    if (req.method === "POST") {
      const b = await jsonBody(req);
      if (!b || !Array.isArray(b.games) || b.games.length > 5000) return send(res, 400, { error: "Lista no válida" });
      const args = [];
      for (const g of b.games) {
        const s = clean(g);
        if (!s) return send(res, 400, { error: `Juego no válido: ${g?.title || g?.id || "?"}` });
        args.push(g.id, s);
      }
      const cmds = [];
      if (b.replace) cmds.push(["DEL", GAMES_KEY]);
      if (args.length) cmds.push(["HSET", GAMES_KEY, ...args]);
      if (cmds.length) await redisTx(cmds);
      return send(res, 200, { ok: true, count: b.games.length });
    }

    res.setHeader("Allow", "GET, PUT, DELETE, POST");
    return send(res, 405, { error: "Método no permitido" });
  } catch (e) {
    console.error(e);
    return send(res, e.status || 500, { error: e.message || "Error del servidor" });
  }
}
