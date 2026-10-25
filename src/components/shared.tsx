"use client";

import { Check, PartyPopper } from "lucide-react";
import Link from "next/link";
import { colorOf, formatDate, shares } from "@/lib/charge";
import { decodeRacha } from "@/lib/share";
import { useHash, useHydrated, useRacha } from "@/lib/store";
import { brl } from "@/lib/split";
import { Footer, Header } from "./home";
import { PixCard } from "./pix-sheet";
import { Receipt } from "./receipt";
import { Avatar } from "./ui";

// Página do link mandado no grupo: a pessoa escolhe o nome e paga o próprio Pix.
function View({ code }: { code: string }) {
  const { me, setMe, paid, togglePaid } = useRacha();
  const racha = decodeRacha(code);
  if (!racha) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border-2 border-ink bg-card p-8 text-center shadow-[4px_4px_0_#1c1a16]">
        <p className="text-2xl font-extrabold">Esse link veio pela metade.</p>
        <p className="mt-2 text-ink-2">Pede pra quem mandou copiar o link de novo, inteirinho.</p>
        <Link href="/" className="mt-6 inline-block rounded-xl border-2 border-ink bg-lime px-4 py-2.5 font-semibold">
          Fazer um racha
        </Link>
      </div>
    );
  }

  const list = shares(racha);
  const payer = list.find((s) => s.isPayer);
  const mine = list.find((s) => s.personId === me[racha.id]);
  const myPaid = paid[racha.id] ?? {};

  return (
    <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_25rem]">
      <div>
        <p className="num text-xs font-semibold uppercase tracking-[0.2em] text-tomato">{formatDate(racha.date) || "racha"}</p>
        <h1 className="mt-2 text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">{racha.title || "Racha"}</h1>
        <p className="mt-3 text-lg text-ink-2">
          {payer ? (
            <>
              <b>{payer.name}</b> pagou a conta.{" "}
            </>
          ) : null}
          O Pix vai pra <b>{racha.payee.name}</b>. Quem é você?
        </p>

        <ul className="mt-6 flex flex-wrap gap-2">
          {list
            .filter((s) => !s.isPayer && s.cents > 0)
            .map((s) => (
              <li key={s.personId}>
                <button
                  type="button"
                  onClick={() => setMe(racha.id, s.personId)}
                  aria-pressed={mine?.personId === s.personId}
                  className={`flex items-center gap-2 rounded-full border-2 py-1.5 pl-1.5 pr-4 font-semibold transition hover:-translate-y-0.5 ${
                    mine?.personId === s.personId ? "border-ink bg-lime shadow-[3px_3px_0_#1c1a16]" : "border-ink/30 bg-card"
                  }`}
                >
                  <Avatar name={s.name} color={colorOf(racha, s.personId)} size={30} />
                  {s.name}
                  {myPaid[s.personId] && <Check className="h-4 w-4 text-mint" />}
                </button>
              </li>
            ))}
        </ul>

        {mine && !mine.isPayer && (
          <div key={mine.personId} className="anim-rise mt-8 max-w-md rounded-3xl border-2 border-ink bg-card p-6 shadow-[6px_6px_0_#1c1a16]">
            <PixCard racha={racha} name={mine.name} cents={mine.cents} />
            <div className="mt-6 border-t-2 border-dashed border-line pt-4">
              <p className="num text-[11px] uppercase tracking-[0.18em] text-muted">O que entrou na sua conta</p>
              <ul className="mt-2 space-y-1 text-sm">
                {mine.parts.map((p, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="truncate">{p.label}</span>
                    <span className="num">{brl(p.cents)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={() => togglePaid(racha.id, mine.personId)}
              className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 font-semibold transition ${
                myPaid[mine.personId] ? "border-mint bg-mint text-white" : "border-ink bg-card hover:bg-mint-soft"
              }`}
            >
              {myPaid[mine.personId] ? (
                <>
                  <PartyPopper className="h-4 w-4" /> Pago! Tá liberado
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Já paguei
                </>
              )}
            </button>
            <p className="mt-2 text-center text-xs text-muted">Essa marcação fica só no seu celular. Manda o comprovante no grupo.</p>
          </div>
        )}
      </div>

      <aside className="lg:sticky lg:top-6">
        <Receipt racha={racha} canPix paid={myPaid} highlight={mine?.personId} />
      </aside>
    </div>
  );
}

export function Shared() {
  const hydrated = useHydrated();
  const code = useHash();
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 sm:px-6">{hydrated ? <View code={code} /> : <div className="mt-10 h-96 animate-pulse rounded-2xl bg-card/60" />}</main>
      <Footer />
    </>
  );
}
