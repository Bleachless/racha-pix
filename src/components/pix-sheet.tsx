"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { pixFor } from "@/lib/charge";
import { KEY_LABEL } from "@/lib/pix";
import type { Racha } from "@/lib/share";
import { brl } from "@/lib/split";
import { CopyButton, Qr } from "./ui";

// O Pix de uma pessoa: QR Code para escanear e o "copia e cola" para quem está no mesmo celular.
export function PixCard({ racha, name, cents }: { racha: Racha; name: string; cents: number }) {
  const code = pixFor(racha, name, cents);
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-muted">{name} paga</p>
      <p className="num mt-1 text-5xl font-bold tracking-tight">{brl(cents)}</p>
      <p className="mt-1 text-sm text-ink-2">
        para <b>{racha.payee.name}</b> · {KEY_LABEL[racha.payee.keyType]}
      </p>
      <div className="mt-5 rounded-2xl border-2 border-ink bg-white p-3">
        <Qr text={code} className="h-56 w-56 sm:h-64 sm:w-64" />
      </div>
      <CopyButton text={code} label="Copiar código Pix" className="mt-5 w-full bg-lime" />
      <p className="mt-3 text-xs text-muted">No app do banco: Pix → Pagar com QR Code ou Pix Copia e Cola.</p>
    </div>
  );
}

export function PixSheet({ racha, name, cents, onClose }: { racha: Racha; name: string; cents: number; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={`Pix de ${name}`}
        className="anim-rise relative w-full max-w-sm rounded-t-3xl border-2 border-ink bg-card p-6 pb-8 shadow-[6px_6px_0_#1c1a16] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} aria-label="Fechar" className="absolute right-4 top-4 rounded-full p-1.5 hover:bg-paper">
          <X className="h-5 w-5" />
        </button>
        <PixCard racha={racha} name={name} cents={cents} />
      </div>
    </div>
  );
}
