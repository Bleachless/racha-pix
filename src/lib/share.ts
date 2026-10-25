// O racha inteiro vai compactado no link, depois do "#": não precisa de servidor
// e o conteúdo nem chega à Vercel (o navegador não envia o que vem depois do #).
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { KeyType } from "./pix";
import type { Bill, Item, Mode, Person } from "./split";

export type Payee = { name: string; key: string; keyType: KeyType; city: string };

export type Racha = {
  id: string;
  title: string;
  date: string; // AAAA-MM-DD
  bill: Bill;
  payee: Payee;
  payerId: string | null; // quem pagou a conta e vai receber dos outros
};

const KEY_TYPES: KeyType[] = ["cpf", "cnpj", "phone", "email", "random"];

// Formato curto: listas posicionais em vez de objetos, para o link ficar menor.
export function encodeRacha(r: Racha) {
  const ppl = r.bill.people.map((p) => [p.id, p.name]);
  const items = r.bill.items.map((it) => [it.name, it.cents, it.qty, it.people.map((id) => r.bill.people.findIndex((p) => p.id === id))]);
  const data = [
    1,
    r.id,
    r.title,
    r.date,
    r.bill.mode === "igual" ? 0 : 1,
    ppl,
    items,
    r.bill.totalCents,
    r.bill.service,
    [r.payee.name, r.payee.key, KEY_TYPES.indexOf(r.payee.keyType), r.payee.city],
    r.payerId ? r.bill.people.findIndex((p) => p.id === r.payerId) : -1,
  ];
  return compressToEncodedURIComponent(JSON.stringify(data));
}

const str = (x: unknown, max = 80) => (typeof x === "string" ? x.slice(0, max) : "");
const int = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.round(x)) : 0);

export function decodeRacha(code: string): Racha | null {
  try {
    const raw = decompressFromEncodedURIComponent(code);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!Array.isArray(d) || d[0] !== 1) return null;
    const people: Person[] = (Array.isArray(d[5]) ? d[5] : []).slice(0, 50).map((p: unknown[]) => ({ id: str(p?.[0], 40), name: str(p?.[1], 40) }));
    const items: Item[] = (Array.isArray(d[6]) ? d[6] : []).slice(0, 200).map((it: unknown[], i: number) => ({
      id: `i${i}`,
      name: str(it?.[0], 60),
      cents: int(it?.[1]),
      qty: Math.max(1, int(it?.[2])),
      people: (Array.isArray(it?.[3]) ? (it[3] as unknown[]) : []).map((k) => people[int(k)]?.id).filter(Boolean) as string[],
    }));
    const payee = Array.isArray(d[9]) ? d[9] : [];
    const payerIdx = typeof d[10] === "number" ? d[10] : -1;
    return {
      id: str(d[1], 40),
      title: str(d[2], 60),
      date: str(d[3], 10),
      bill: { mode: (d[4] === 0 ? "igual" : "itens") as Mode, people, items, totalCents: int(d[7]), service: Math.min(30, int(d[8])) },
      payee: { name: str(payee[0], 40), key: str(payee[1], 80), keyType: KEY_TYPES[int(payee[2])] ?? "random", city: str(payee[3], 40) },
      payerId: payerIdx >= 0 ? (people[payerIdx]?.id ?? null) : null,
    };
  } catch {
    return null;
  }
}
