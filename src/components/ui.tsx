"use client";

import { Check, Copy } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { useMemo, useState, type ReactNode } from "react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 ${className}`} aria-label="Racha, início">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <path d="M6 3h20v24l-3.33-2-3.34 2L16 25l-3.33 2-3.34-2L6 27z" fill="#fffdf7" stroke="#1c1a16" strokeWidth="2" strokeLinejoin="round" />
        <path d="M11 10h10M11 15h10M11 20h6" stroke="#1c1a16" strokeWidth="2" strokeLinecap="round" />
        <path d="M16 1v30" stroke="#ff5a2c" strokeWidth="2.5" strokeDasharray="3 2.5" />
      </svg>
      <span className="text-2xl font-extrabold tracking-tight">
        racha<span className="text-tomato">.</span>
      </span>
    </Link>
  );
}

export function Avatar({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ background: color, width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

export function Card({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border-2 border-ink bg-card p-5 shadow-[4px_4px_0_#1c1a16] sm:p-6">
      <div className="flex items-baseline gap-3">
        <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-paper">{n}</span>
        <div>
          <h2 className="text-xl font-bold leading-tight">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-full border-2 border-ink bg-paper p-1" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${value === o.value ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CopyButton({ text, label, className = "" }: { text: string; label: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const t = document.createElement("textarea");
          t.value = text;
          document.body.appendChild(t);
          t.select();
          document.execCommand("copy");
          t.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border-2 border-ink px-4 py-3 font-semibold transition active:translate-y-0.5 ${
        done ? "bg-mint text-white" : "bg-card hover:bg-lime"
      } ${className}`}
    >
      {done ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {done ? "Copiado!" : label}
    </button>
  );
}

// QR Code desenhado como SVG: nítido em qualquer tamanho e sem esperar nada carregar.
export function Qr({ text, className = "" }: { text: string; className?: string }) {
  const path = useMemo(() => {
    const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    let d = "";
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.data[y * n + x]) d += `M${x} ${y}h1v1h-1z`;
    return { d, n };
  }, [text]);
  return (
    <svg viewBox={`-3 -3 ${path.n + 6} ${path.n + 6}`} className={className} shapeRendering="crispEdges" role="img" aria-label="QR Code Pix">
      <rect x="-3" y="-3" width={path.n + 6} height={path.n + 6} fill="#fff" />
      <path d={path.d} fill="#1c1a16" />
    </svg>
  );
}
