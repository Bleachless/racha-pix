// Nota fiscal do consumidor (NFC-e): o QR Code do cupom é um link para a consulta pública da Sefaz do
// estado. Aqui ficam a checagem do link, a leitura da página de consulta e a conversão em itens do racha.
import { allocate } from "./split";

export type NotaItem = { name: string; qty: number; unit: string; unitCents: number; totalCents: number };
export type Nota = { store: string; items: NotaItem[]; totalCents: number; discountCents: number; paidCents: number };

// Só aceita a consulta das Fazendas estaduais (gov.br), para a rota não virar um proxy aberto.
export function isNfceUrl(raw: string) {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    return host.endsWith(".gov.br") && /(fazenda|sefaz|sef\.|nfce|nfe\.)/.test(host);
  } catch {
    return false;
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-z]+);/gi, (m, k) => ENTITIES[k.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " "));
const brNumber = (s: string) => Number(s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
const cents = (s: string) => Math.round(brNumber(s) * 100);
const spanByClass = (html: string, cls: string) => {
  const m = html.match(new RegExp(`<span[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>([\\s\\S]*?)</span>`, "i"));
  return m ? m[1] : "";
};

// Lê a página de consulta no layout padrão que a maioria das Sefaz usa (tabela "tabResult").
export function parseNfce(html: string): Nota | null {
  const rows = html.match(/<tr[^>]*id="Item[^"]*"[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  const items: NotaItem[] = [];
  for (const row of rows) {
    const name = text(spanByClass(row, "txtTit2") || spanByClass(row, "txtTit"));
    const qty = brNumber(text(spanByClass(row, "Rqtd")).replace(/qtde\.?:/i, ""));
    const unit = text(spanByClass(row, "RUN")).replace(/^UN:\s*/i, "") || "UN";
    const unitCents = cents(text(spanByClass(row, "RvlUnit")).replace(/vl\.?\s*unit\.?:/i, ""));
    const totalCents = cents(text(spanByClass(row, "valor")));
    if (name && totalCents > 0) items.push({ name, qty: qty || 1, unit, unitCents, totalCents });
  }
  if (!items.length) return null;

  const line = (label: RegExp) => {
    const m = html.match(new RegExp(`<label>\\s*${label.source}[\\s\\S]*?<span[^>]*class="[^"]*totalNumb[^"]*"[^>]*>([^<]*)<`, "i"));
    return m ? cents(m[1]) : 0;
  };
  const sum = items.reduce((s, it) => s + it.totalCents, 0);
  const totalCents = line(/Valor total/) || sum;
  const discountCents = line(/Descontos?/);
  const paidCents = line(/Valor a pagar/) || totalCents - discountCents;
  const store = text(html.match(/<div[^>]*id="u20"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
  return { store, items, totalCents, discountCents, paidCents };
}

const title = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase())
    .replace(/(\s)(De|Da|Do|Das|Dos|E|Com|Sem)(?=\s)/g, (_, sp, w) => sp + w.toLowerCase())
    .slice(0, 40);

// Converte em itens do racha. Quantidade quebrada (kg) vira um item só com o total; com desconto na nota,
// o desconto é repartido entre os itens na proporção do preço, para a comanda fechar com o que foi pago.
export function notaToItems(nota: Nota): { name: string; cents: number; qty: number }[] {
  const discounted = nota.discountCents > 0 && nota.paidCents > 0 && nota.paidCents < nota.totalCents;
  const paid = discounted ? allocate(nota.paidCents, nota.items.map((it) => it.totalCents)) : null;
  return nota.items.map((it, i) => {
    const whole = Number.isInteger(it.qty) && it.qty >= 1 && it.unitCents * it.qty === it.totalCents;
    if (whole && !paid) return { name: title(it.name), cents: it.unitCents, qty: it.qty };
    const label = whole ? (it.qty > 1 ? `${it.qty}× ${title(it.name)}` : title(it.name)) : `${title(it.name)} (${it.qty.toLocaleString("pt-BR")} ${it.unit.toLowerCase()})`;
    return { name: label.slice(0, 40), cents: paid ? paid[i] : it.totalCents, qty: 1 };
  });
}
