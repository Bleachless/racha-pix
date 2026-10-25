"use client";

import { Check, QrCode } from "lucide-react";
import { colorOf, formatDate, shares } from "@/lib/charge";
import type { Racha } from "@/lib/share";
import { brl, grandTotal, itemTotal, serviceCents, subtotal } from "@/lib/split";
import { Avatar } from "./ui";

const ticket = (id: string) => String([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 10000, 7)).padStart(4, "0");

const Dashed = () => <div className="my-4 border-t-2 border-dashed border-line" />;

// A comanda: itens, total e quanto cada um paga. Na página do link fica só para leitura.
export function Receipt({
  racha,
  canPix,
  paid = {},
  onPix,
  onTogglePaid,
  highlight,
}: {
  racha: Racha;
  canPix: boolean;
  paid?: Record<string, boolean>;
  onPix?: (personId: string) => void;
  onTogglePaid?: (personId: string) => void;
  highlight?: string;
}) {
  const list = shares(racha);
  const debtors = list.filter((s) => !s.isPayer && s.cents > 0);
  const settled = debtors.length > 0 && debtors.every((s) => paid[s.personId]);
  const toReceive = debtors.reduce((sum, s) => sum + s.cents, 0);
  const { bill } = racha;
  const empty = bill.people.length === 0 || grandTotal(bill) === 0;

  return (
    <div className="receipt-shadow">
      <div className="zigzag relative rounded-t-2xl bg-card px-6 pt-6 text-ink sm:px-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="num text-[11px] uppercase tracking-[0.18em] text-muted">Comanda nº {ticket(racha.id)}</p>
            <h3 className="mt-1 line-clamp-2 text-2xl font-extrabold leading-tight">{racha.title || "Racha de hoje"}</h3>
          </div>
          {racha.date && <p className="num shrink-0 pt-1 text-xs text-muted">{formatDate(racha.date)}</p>}
        </div>

        <Dashed />

        {bill.mode === "itens" ? (
          bill.items.length ? (
            <ul className="space-y-2.5">
              {bill.items.map((it) => {
                const eaters = it.people.length ? it.people : bill.people.map((p) => p.id);
                return (
                  <li key={it.id} className="text-sm">
                    <div className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate">
                        {it.qty > 1 && <span className="num text-muted">{it.qty}× </span>}
                        {it.name || "Item"}
                      </span>
                      <span className="num">{brl(itemTotal(it))}</span>
                    </div>
                    <div className="mt-1 flex -space-x-1">
                      {eaters.slice(0, 8).map((id) => {
                        const p = bill.people.find((x) => x.id === id);
                        return p ? <Avatar key={id} name={p.name} color={colorOf(racha, id)} size={16} /> : null;
                      })}
                      {!it.people.length && <span className="pl-2 text-[11px] text-muted">todo mundo</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-2 text-sm text-muted">Nenhum item ainda.</p>
          )
        ) : (
          <div className="flex items-baseline justify-between text-sm">
            <span>Conta dividida igual</span>
            <span className="num">{brl(bill.totalCents)}</span>
          </div>
        )}

        {bill.service > 0 && subtotal(bill) > 0 && (
          <div className="mt-3 flex items-baseline justify-between text-sm text-ink-2">
            <span>Serviço ({bill.service}%)</span>
            <span className="num">{brl(serviceCents(bill))}</span>
          </div>
        )}

        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-sm font-bold uppercase tracking-wider">Total</span>
          <span className="num text-3xl font-bold">{brl(grandTotal(bill))}</span>
        </div>

        <Dashed />

        <p className="num text-[11px] uppercase tracking-[0.18em] text-muted">Cada um paga</p>
        {empty ? (
          <p className="mt-3 text-sm text-muted">Coloque quem está na mesa e o que foi pedido.</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {list.map((s) => {
              const isPaid = paid[s.personId];
              return (
                <li
                  key={s.personId}
                  className={`relative flex items-center gap-3 rounded-xl px-2 py-2 transition ${highlight === s.personId ? "bg-lime" : ""}`}
                >
                  <Avatar name={s.name} color={colorOf(racha, s.personId)} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold leading-tight">
                      <span className="truncate">{s.name}</span>
                      {isPaid && !s.isPayer && (
                        <span className="anim-stamp shrink-0 rounded border-2 border-mint px-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-mint">
                          pago
                        </span>
                      )}
                    </p>
                    {s.isPayer && <p className="text-xs text-mint">pagou a conta · recebe {brl(toReceive)}</p>}
                  </div>
                  <span className={`num font-bold ${s.isPayer ? "text-muted" : ""}`} title={s.isPayer ? "A parte dele, que já está paga" : undefined}>
                    {brl(s.cents)}
                  </span>
                  {!s.isPayer && s.cents > 0 && (
                    <div className="flex items-center gap-1">
                      {onPix && (
                        <button
                          type="button"
                          disabled={!canPix}
                          onClick={() => onPix(s.personId)}
                          aria-label={`Ver Pix de ${s.name}`}
                          title={canPix ? `Pix de ${s.name}` : "Coloque a chave Pix de quem recebe"}
                          className="rounded-lg border-2 border-ink bg-card p-1.5 transition hover:bg-lime disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <QrCode className="h-4 w-4" />
                        </button>
                      )}
                      {onTogglePaid && (
                        <button
                          type="button"
                          onClick={() => onTogglePaid(s.personId)}
                          aria-pressed={!!isPaid}
                          aria-label={isPaid ? `Desmarcar pagamento de ${s.name}` : `Marcar que ${s.name} pagou`}
                          className={`rounded-lg border-2 p-1.5 transition ${isPaid ? "border-mint bg-mint text-white" : "border-line text-muted hover:border-ink hover:text-ink"}`}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {racha.payee.name && (
          <>
            <Dashed />
            <p className="text-xs text-muted">
              Pix para <b className="text-ink">{racha.payee.name}</b>
              {racha.payee.city ? ` · ${racha.payee.city}` : ""}
            </p>
          </>
        )}
        <p className="num mt-4 text-center text-[11px] uppercase tracking-[0.2em] text-muted">obrigado, volte sempre</p>

        {settled && (
          <div className="anim-stamp pointer-events-none absolute right-6 top-20 rounded-lg border-4 border-mint px-3 py-1 font-mono text-2xl font-bold uppercase tracking-widest text-mint opacity-90">
            quitado
          </div>
        )}
      </div>
    </div>
  );
}
