// POST /api/upload  (cuerpo: la imagen ya reducida, application/octet-stream) → { url }
// Guarda fotos propias de las cajas en Vercel Blob (requiere contraseña de edición)
import { put } from "@vercel/blob";
import { HAS_BLOB, isEditor, send, rawBody } from "./_lib.js";

const TYPES = [
  { sig: [0xff, 0xd8, 0xff], type: "image/jpeg", ext: "jpg" },
  { sig: [0x89, 0x50, 0x4e, 0x47], type: "image/png", ext: "png" },
  { sig: [0x52, 0x49, 0x46, 0x46], type: "image/webp", ext: "webp" },
];

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Usa POST" });
  if (!HAS_BLOB) return send(res, 501, { error: "Vercel Blob no configurado" });
  if (!isEditor(req)) return send(res, 401, { error: "Contraseña de edición incorrecta" });
  try {
    const buf = await rawBody(req, 3.5e6);
    const t = TYPES.find((t) => t.sig.every((b, i) => buf[i] === b));
    if (!t) return send(res, 400, { error: "Formato de imagen no admitido" });
    const blob = await put(`covers/foto.${t.ext}`, buf, { access: "public", contentType: t.type, addRandomSuffix: true });
    return send(res, 200, { url: blob.url });
  } catch (e) {
    console.error(e);
    return send(res, e.status || 500, { error: e.message });
  }
}
