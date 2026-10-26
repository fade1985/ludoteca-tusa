// POST /api/auth → 200 si la contraseña (cabecera x-ludoteca-key) es correcta
import { HAS_PASSWORD, isEditor, send } from "./_lib.js";

export default function handler(req, res) {
  if (!HAS_PASSWORD) return send(res, 503, { error: "Falta configurar EDIT_PASSWORD en Vercel" });
  return isEditor(req) ? send(res, 200, { ok: true }) : send(res, 401, { error: "Contraseña incorrecta" });
}
