"use client";

import jsQR from "jsqr";
import { Camera, ImageUp, Link2, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isNfceUrl, type Nota } from "@/lib/nfce";
import { brl } from "@/lib/split";
import { Segmented } from "./ui";

export type NotaItems = { name: string; cents: number; qty: number }[];
type Tab = "camera" | "foto" | "link";
type Status = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "ok"; nota: Nota; items: NotaItems };

// Procura um QR Code numa imagem (frame da câmera ou foto), reduzindo antes para ficar rápido.
function readQr(source: CanvasImageSource, w: number, h: number, max: number, both = false) {
  const scale = Math.min(1, max / Math.max(w, h));
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || !cw || !ch) return null;
  ctx.drawImage(source, 0, 0, cw, ch);
  const data = ctx.getImageData(0, 0, cw, ch);
  return jsQR(data.data, cw, ch, { inversionAttempts: both ? "attemptBoth" : "dontInvert" })?.data ?? null;
}

function CameraView({ onCode, onError }: { onCode: (text: string) => void; onError: (message: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const tick = () => {
          const v = video.current;
          if (stopped || !v) return;
          if (v.readyState >= 2) {
            const text = readQr(v, v.videoWidth, v.videoHeight, 720);
            if (text) {
              stopped = true;
              onCode(text);
              return;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        onError("Não deu pra abrir a câmera. Libera a permissão ou usa uma foto do cupom.");
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode, onError]);

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-ink bg-ink">
      <video ref={video} playsInline muted className="aspect-square w-full object-cover" />
      <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-lime/90 shadow-[0_0_0_999px_rgba(28,26,22,0.45)]" />
      <p className="absolute inset-x-0 bottom-3 text-center text-sm font-semibold text-white">Aponta pro QR Code do cupom</p>
    </div>
  );
}

// Janela para ler a nota fiscal: câmera, foto do cupom ou link colado.
export function NotaScanner({ onClose, onAdd }: { onClose: () => void; onAdd: (items: NotaItems, nota: Nota) => void }) {
  const [tab, setTab] = useState<Tab>("camera");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [link, setLink] = useState("");
  const onCodeRef = useRef<(text: string) => void>(() => {});

  const fetchNota = async (text: string) => {
    if (!isNfceUrl(text)) {
      setStatus({ kind: "error", message: "Esse QR Code não é de nota fiscal (NFC-e). Procura o QR do cupom, perto do total." });
      return;
    }
    setStatus({ kind: "loading" });
    try {
      const res = await fetch(`/api/nfce?url=${encodeURIComponent(text.trim())}`);
      const body = await res.json();
      if (!res.ok) setStatus({ kind: "error", message: body.error ?? "Não deu pra ler essa nota." });
      else setStatus({ kind: "ok", nota: body.nota, items: body.items });
    } catch {
      setStatus({ kind: "error", message: "Sem conexão com a Sefaz agora. Tenta de novo." });
    }
  };
  useEffect(() => {
    onCodeRef.current = fetchNota;
  });

  // Callbacks estáveis para a câmera não reiniciar a cada render.
  const [cameraCallbacks] = useState(() => ({
    onCode: (text: string) => onCodeRef.current(text),
    onError: (message: string) => setStatus({ kind: "error", message }),
  }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setStatus({ kind: "loading" });
    const bitmap = await createImageBitmap(file).catch(() => null);
    const text = bitmap ? readQr(bitmap, bitmap.width, bitmap.height, 1600, true) : null;
    if (text) fetchNota(text);
    else setStatus({ kind: "error", message: "Não achei o QR Code na foto. Tenta mais de perto, com o cupom bem iluminado." });
  };

  const scanning = status.kind === "idle" || status.kind === "error";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label="Ler nota fiscal"
        className="anim-rise relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-2 border-ink bg-card p-6 shadow-[6px_6px_0_#1c1a16] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} aria-label="Fechar" className="absolute right-4 top-4 rounded-full p-1.5 hover:bg-paper">
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-2xl font-extrabold">Ler a nota fiscal</h2>
        <p className="mt-1 text-sm text-ink-2">Lê o QR Code do cupom (NFC-e) e já traz os itens da conta.</p>

        {status.kind === "ok" ? (
          <div className="mt-5">
            <p className="num text-[11px] uppercase tracking-[0.18em] text-muted">{status.nota.store || "Nota fiscal"}</p>
            <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1 text-sm">
              {status.items.map((it, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate">
                    {it.qty > 1 && <span className="num text-muted">{it.qty}× </span>}
                    {it.name}
                  </span>
                  <span className="num">{brl(it.cents * it.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-baseline justify-between border-t-2 border-dashed border-line pt-3">
              <span className="text-sm font-bold uppercase tracking-wider">Pago</span>
              <span className="num text-xl font-bold">{brl(status.nota.paidCents)}</span>
            </div>
            {status.nota.discountCents > 0 && (
              <p className="mt-1 text-xs text-muted">O desconto de {brl(status.nota.discountCents)} foi repartido entre os itens.</p>
            )}
            <p className="mt-1 text-xs text-muted">O serviço fica zerado, porque a nota já é o valor cobrado. Se os 10% vieram à parte, é só ligar de novo.</p>
            <button
              type="button"
              onClick={() => onAdd(status.items, status.nota)}
              className="mt-5 w-full rounded-xl border-2 border-ink bg-tomato px-4 py-3.5 text-lg font-bold text-white shadow-[4px_4px_0_#1c1a16] transition hover:-translate-y-0.5"
            >
              Adicionar {status.items.length} {status.items.length === 1 ? "item" : "itens"}
            </button>
            <button type="button" onClick={() => setStatus({ kind: "idle" })} className="mt-2 w-full py-2 text-sm font-semibold text-muted hover:text-ink">
              Ler outra nota
            </button>
          </div>
        ) : (
          <div className="mt-5">
            <Segmented
              value={tab}
              onChange={(t) => {
                setTab(t);
                setStatus({ kind: "idle" });
              }}
              options={[
                { value: "camera", label: "Câmera" },
                { value: "foto", label: "Foto" },
                { value: "link", label: "Link" },
              ]}
            />
            <div className="mt-4">
              {status.kind === "loading" ? (
                <div className="flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line text-ink-2">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  Buscando a nota na Sefaz…
                </div>
              ) : tab === "camera" && scanning && status.kind !== "error" ? (
                <CameraView onCode={cameraCallbacks.onCode} onError={cameraCallbacks.onError} />
              ) : tab === "foto" ? (
                <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/40 bg-paper text-center hover:border-ink">
                  <ImageUp className="h-8 w-8" />
                  <span className="font-semibold">Tirar ou escolher foto do cupom</span>
                  <span className="text-xs text-muted">com o QR Code aparecendo inteiro</span>
                  <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
                </label>
              ) : tab === "link" ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    fetchNota(link);
                  }}
                >
                  <textarea
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    rows={3}
                    placeholder="Cola o link do QR Code da nota (https://…fazenda…gov.br/…)"
                    className="w-full resize-none rounded-xl border-2 border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-ink"
                  />
                  <button type="submit" className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-ink bg-lime px-4 py-3 font-semibold">
                    <Link2 className="h-4 w-4" /> Buscar itens
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setStatus({ kind: "idle" })}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-ink-2"
                >
                  <Camera className="h-8 w-8" />
                  Tentar a câmera de novo
                </button>
              )}
            </div>
            {status.kind === "error" && <p className="mt-3 rounded-xl bg-tomato/10 px-3 py-2 text-sm text-tomato-dark">{status.message}</p>}
            <p className="mt-4 text-xs text-muted">
              A consulta é feita na Sefaz do estado da nota. Algumas pedem captcha e não deixam ler: aí é lançar na mão mesmo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
