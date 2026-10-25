// Divisão da conta em centavos inteiros: a soma das partes sempre fecha com o total.

export type Person = { id: string; name: string };
export type Item = { id: string; name: string; cents: number; qty: number; people: string[] }; // people vazio = todo mundo
export type Mode = "igual" | "itens";

export type Bill = {
  mode: Mode;
  people: Person[];
  items: Item[];
  totalCents: number; // usado no modo "igual"
  service: number; // % de serviço (0 ou 10, em geral)
};

export type Share = { personId: string; cents: number; parts: { label: string; cents: number }[] };

// Método do maior resto: arredonda para baixo e entrega os centavos que sobram para as maiores frações.
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const out = exact.map(Math.floor);
  let left = total - out.reduce((s, x) => s + x, 0);
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k].i]++;
  return out;
}

export const itemTotal = (it: Item) => it.cents * Math.max(1, it.qty);

export function subtotal(bill: Bill) {
  return bill.mode === "igual" ? bill.totalCents : bill.items.reduce((s, it) => s + itemTotal(it), 0);
}

export function serviceCents(bill: Bill) {
  return Math.round((subtotal(bill) * bill.service) / 100);
}

export function grandTotal(bill: Bill) {
  return subtotal(bill) + serviceCents(bill);
}

export function computeShares(bill: Bill): Share[] {
  const ids = bill.people.map((p) => p.id);
  const parts = new Map<string, { label: string; cents: number }[]>(ids.map((id) => [id, []]));
  const base = new Map<string, number>(ids.map((id) => [id, 0]));
  if (ids.length === 0) return [];

  if (bill.mode === "igual") {
    allocate(bill.totalCents, ids.map(() => 1)).forEach((c, i) => {
      base.set(ids[i], c);
      if (c) parts.get(ids[i])!.push({ label: "Parte da conta", cents: c });
    });
  } else {
    for (const it of bill.items) {
      const who = it.people.filter((id) => base.has(id));
      const eaters = who.length ? who : ids;
      allocate(itemTotal(it), eaters.map(() => 1)).forEach((c, i) => {
        const id = eaters[i];
        base.set(id, base.get(id)! + c);
        if (c) parts.get(id)!.push({ label: it.qty > 1 ? `${it.qty}× ${it.name}` : it.name, cents: c });
      });
    }
  }

  if (!serviceCents(bill)) return ids.map((id) => ({ personId: id, cents: base.get(id)!, parts: parts.get(id)! }));

  // Com serviço, o total final é dividido de uma vez pelo consumo exato de cada um
  // (arredondar duas vezes deixaria um centavo torto); a linha do serviço é a diferença.
  const exact = ids.map((id) =>
    bill.mode === "igual"
      ? 1
      : bill.items.reduce((s, it) => {
          const who = it.people.filter((x) => base.has(x));
          const eaters = who.length ? who : ids;
          return eaters.includes(id) ? s + itemTotal(it) / eaters.length : s;
        }, 0),
  );
  const final = allocate(grandTotal(bill), exact);
  return ids.map((id, i) => {
    const p = parts.get(id)!;
    const svc = final[i] - base.get(id)!;
    if (svc) p.push({ label: `Serviço (${bill.service}%)`, cents: svc });
    return { personId: id, cents: final[i], parts: p };
  });
}

export function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// "12,50", "R$ 12,5", "12.50" ou "1.234,56" viram centavos.
export function parseMoney(text: string): number {
  const t = text.replace(/[^\d,.-]/g, "");
  if (!t) return 0;
  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  let normalized: string;
  if (lastComma > lastDot) normalized = t.replace(/\./g, "").replace(",", ".");
  else if (lastDot > -1 && t.length - lastDot - 1 === 3 && lastComma === -1) normalized = t.replace(/\./g, "");
  else normalized = t.replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}
