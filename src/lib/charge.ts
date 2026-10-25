// O que cada pessoa paga, o código Pix dela e o texto para mandar no grupo.
import { keyError, normalizeKey, pixPayload } from "./pix";
import { encodeRacha, type Racha } from "./share";
import { brl, computeShares, grandTotal, type Share } from "./split";

export const COLORS = ["#ff5a2c", "#3d6fe0", "#138a5a", "#e2a400", "#9b4de0", "#e0457b", "#0f9aa3", "#7a5c3e"];

export function colorOf(racha: Racha, personId: string) {
  const i = racha.bill.people.findIndex((p) => p.id === personId);
  return COLORS[(i < 0 ? 0 : i) % COLORS.length];
}

export function shares(racha: Racha): (Share & { name: string; isPayer: boolean })[] {
  return computeShares(racha.bill).map((s) => ({
    ...s,
    name: racha.bill.people.find((p) => p.id === s.personId)?.name || "Sem nome",
    isPayer: s.personId === racha.payerId,
  }));
}

export function payeeReady(racha: Racha) {
  return !keyError(racha.payee.key, racha.payee.keyType) && racha.payee.name.trim().length > 0;
}

export function pixFor(racha: Racha, personName: string, cents: number) {
  const initials = personName
    .normalize("NFD")
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .map((w) => w.slice(0, 6))
    .join("")
    .toUpperCase();
  return pixPayload({
    key: normalizeKey(racha.payee.key, racha.payee.keyType),
    name: racha.payee.name,
    city: racha.payee.city || "Brasil",
    cents,
    txid: `RACHA${initials}`.slice(0, 25),
    message: `Racha ${personName}`,
  });
}

export function shareUrl(racha: Racha, origin: string) {
  return `${origin}/r#${encodeRacha(racha)}`;
}

export function whatsappText(racha: Racha, url: string) {
  const list = shares(racha);
  const lines = list
    .filter((s) => !s.isPayer && s.cents > 0)
    .map((s) => `• ${s.name}: *${brl(s.cents)}*`)
    .join("\n");
  const svc = racha.bill.service ? ` (com ${racha.bill.service}% de serviço)` : "";
  return [
    `🧾 *${racha.title || "Racha"}*`,
    `Total: ${brl(grandTotal(racha.bill))}${svc}`,
    "",
    lines,
    "",
    `Pix pra *${racha.payee.name}*. Abre o link, escolhe seu nome e paga o seu QR Code 👇`,
    url,
  ].join("\n");
}

export function formatDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
