"use client";

import { MessageCircle, RotateCcw, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { payeeReady, shares, shareUrl, whatsappText } from "@/lib/charge";
import { example, useHydrated, useRacha } from "@/lib/store";
import { brl, grandTotal } from "@/lib/split";
import { Editor } from "./editor";
import { PixSheet } from "./pix-sheet";
import { Receipt } from "./receipt";
import { CopyButton, Logo } from "./ui";

export function Header() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
      <Logo />
      <a href="https://github.com/Bleachless/racha-pix" target="_blank" rel="noreferrer" className="text-sm font-semibold text-ink-2 underline-offset-4 hover:underline">
        código aberto ↗
      </a>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-4 pb-28 pt-16 text-sm text-muted sm:px-6 lg:pb-12">
      <p>
        Os dados ficam no seu navegador e dentro do próprio link. O Racha só monta o código Pix no padrão do Banco Central: o pagamento acontece no app do
        seu banco.
      </p>
      <p className="mt-2">
        Feito por{" "}
        <a href="https://portifolio-joao-vaz.vercel.app" className="font-semibold text-ink underline-offset-4 hover:underline">
          João Vaz
        </a>
        .
      </p>
    </footer>
  );
}

function Steps() {
  const steps = ["Põe quem tá na mesa", "Lança o que foi pedido", "Manda o link no grupo", "Cada um paga o seu Pix"];
  return (
    <ol className="mt-8 flex flex-wrap gap-2">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2 rounded-full border-2 border-ink bg-card px-3 py-1.5 text-sm font-semibold">
          <span className="num flex h-5 w-5 items-center justify-center rounded-full bg-tomato text-[11px] text-white">{i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}

function Workspace() {
  const { racha, paid, togglePaid, load, reset } = useRacha();
  const [pixOf, setPixOf] = useState<string | null>(null);
  const close = useCallback(() => setPixOf(null), []);
  const list = shares(racha);
  const ready = payeeReady(racha);
  const total = grandTotal(racha.bill);
  const charged = list.filter((s) => !s.isPayer && s.cents > 0);
  const canShare = ready && charged.length > 0;
  const url = shareUrl(racha, location.origin);
  const open = list.find((s) => s.personId === pixOf);
  const isEmpty = racha.bill.people.length <= 1 && racha.bill.items.length === 0 && !racha.bill.totalCents;

  return (
    <>
      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_25rem]">
        <div>
          {isEmpty && (
            <button
              type="button"
              onClick={() => load(example())}
              className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-lime px-4 py-2 font-semibold shadow-[3px_3px_0_#1c1a16] transition hover:-translate-y-0.5"
            >
              <Sparkles className="h-4 w-4" /> Ver um exemplo pronto
            </button>
          )}
          <Editor key={racha.id} />
        </div>

        <aside id="comanda" className="lg:sticky lg:top-6">
          <Receipt racha={racha} canPix={ready} paid={paid[racha.id]} onPix={setPixOf} onTogglePaid={(id) => togglePaid(racha.id, id)} />
          <div className="mt-6 space-y-2.5">
            <a
              href={canShare ? `https://wa.me/?text=${encodeURIComponent(whatsappText(racha, url))}` : undefined}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!canShare}
              className={`flex w-full items-center justify-center gap-2 rounded-xl border-2 border-ink px-4 py-3.5 text-lg font-bold shadow-[4px_4px_0_#1c1a16] transition ${
                canShare ? "bg-tomato text-white hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none" : "pointer-events-none bg-line text-muted shadow-none"
              }`}
            >
              <MessageCircle className="h-5 w-5" /> Mandar no grupo
            </a>
            {canShare ? (
              <CopyButton text={url} label="Copiar link do racha" className="w-full" />
            ) : (
              <p className="text-center text-sm text-muted">
                {ready ? "Falta alguém pra pagar: põe mais gente e os valores." : "Preencha o nome e a chave Pix de quem recebe pra liberar os Pix."}
              </p>
            )}
            <button
              type="button"
              onClick={() => confirm("Começar um racha novo? Este aqui some do editor (quem tem o link continua vendo).") && reset()}
              className="flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-muted hover:text-ink"
            >
              <RotateCcw className="h-4 w-4" /> Começar outro racha
            </button>
          </div>
        </aside>
      </div>

      {/* No celular, o total fica sempre à vista. */}
      {total > 0 && (
        <a
          href="#comanda"
          className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-between rounded-2xl border-2 border-ink bg-ink px-5 py-3.5 text-paper shadow-[0_10px_30px_rgba(0,0,0,0.25)] lg:hidden"
        >
          <span className="text-sm font-semibold">Total da comanda</span>
          <span className="num text-lg font-bold">{brl(total)} ↓</span>
        </a>
      )}

      {open && <PixSheet racha={racha} name={open.name} cents={open.cents} onClose={close} />}
    </>
  );
}

export function Home() {
  const hydrated = useHydrated();
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="pt-6 sm:pt-10">
          <p className="num text-xs font-semibold uppercase tracking-[0.2em] text-tomato">sem cadastro · sem app · sem taxa</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">
            Racha a conta.
            <br />
            <span className="relative inline-block">
              <span className="relative z-10">Cada um paga o seu Pix.</span>
              <span className="absolute inset-x-0 bottom-1 z-0 h-4 -rotate-1 bg-lime sm:bottom-2 sm:h-6" aria-hidden />
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-2">
            Monta a comanda, divide por item ou igual e manda no grupo. Cada pessoa abre o link, acha o nome dela e paga o próprio QR Code.
          </p>
          <Steps />
        </section>
        {hydrated ? <Workspace /> : <div className="mt-10 h-[40rem] animate-pulse rounded-2xl bg-card/60" />}
      </main>
      <Footer />
    </>
  );
}
