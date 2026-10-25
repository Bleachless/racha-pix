"use client";

import { Coins, Minus, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { colorOf } from "@/lib/charge";
import { KEY_LABEL, keyError, type KeyType } from "@/lib/pix";
import { useRacha } from "@/lib/store";
import { parseMoney } from "@/lib/split";
import { Avatar, Card, Segmented } from "./ui";

const PRESETS = [
  { name: "Cerveja", emoji: "🍺" },
  { name: "Pizza", emoji: "🍕" },
  { name: "Carne", emoji: "🥩" },
  { name: "Porção", emoji: "🍟" },
  { name: "Refri", emoji: "🥤" },
  { name: "Drink", emoji: "🍹" },
];

const input =
  "w-full rounded-xl border-2 border-line bg-white px-3 py-2.5 outline-none transition placeholder:text-muted/70 focus:border-ink";

// Campo de dinheiro sem máscara chata: aceita "12,50", "12.5" ou "R$ 12".
function Money({ cents, onChange, label, className = "" }: { cents: number; onChange: (c: number) => void; label: string; className?: string }) {
  return (
    <label className={`relative block ${className}`}>
      <span className="sr-only">{label}</span>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">R$</span>
      <input
        inputMode="decimal"
        defaultValue={cents ? (cents / 100).toFixed(2).replace(".", ",") : ""}
        onChange={(e) => onChange(parseMoney(e.target.value))}
        placeholder="0,00"
        className={`${input} num pl-9 text-right`}
      />
    </label>
  );
}

function People() {
  const { racha, addPerson, removePerson, renamePerson, setPayer } = useRacha();
  const [name, setName] = useState("");
  const add = () => {
    addPerson(name);
    setName("");
  };
  return (
    <Card n={1} title="Quem tá na mesa?" hint="Toque na moeda de quem pagou a conta: essa pessoa recebe dos outros.">
      <ul className="flex flex-wrap gap-2">
        {racha.bill.people.map((p) => {
          const payer = racha.payerId === p.id;
          return (
            <li key={p.id} className={`anim-pop flex items-center gap-1.5 rounded-full border-2 py-1 pl-1 pr-1.5 ${payer ? "border-mint bg-mint-soft" : "border-line bg-white"}`}>
              <Avatar name={p.name} color={colorOf(racha, p.id)} />
              <input
                value={p.name}
                onChange={(e) => renamePerson(p.id, e.target.value)}
                aria-label="Nome"
                className="w-[7ch] min-w-0 bg-transparent font-semibold outline-none"
                style={{ width: `${Math.max(3, p.name.length + 1)}ch` }}
              />
              <button
                type="button"
                onClick={() => setPayer(payer ? null : p.id)}
                aria-pressed={payer}
                title={payer ? "Pagou a conta" : "Marcar quem pagou a conta"}
                className={`rounded-full p-1 transition ${payer ? "bg-mint text-white" : "text-muted hover:text-ink"}`}
              >
                <Coins className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => removePerson(p.id)} aria-label={`Tirar ${p.name}`} className="rounded-full p-1 text-muted hover:text-tomato">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome de quem tá junto" className={input} maxLength={30} />
        <button type="submit" className="inline-flex shrink-0 items-center gap-1 rounded-xl border-2 border-ink bg-ink px-4 font-semibold text-paper transition hover:bg-ink-2 active:translate-y-0.5">
          <Plus className="h-4 w-4" /> Pôr
        </button>
      </form>
    </Card>
  );
}

function Items() {
  const { racha, setMode, setTotal, setService, addItem, updateItem, toggleEater, removeItem } = useRacha();
  const { bill } = racha;
  return (
    <Card n={2} title="O que foi pedido?" hint="Por item, cada um paga só o que consumiu. Ou divide tudo igual.">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={bill.mode}
          onChange={setMode}
          options={[
            { value: "itens", label: "Por item" },
            { value: "igual", label: "Tudo igual" },
          ]}
        />
        <label className="flex items-center gap-2 text-sm font-semibold">
          Serviço
          <select value={bill.service} onChange={(e) => setService(Number(e.target.value))} className="rounded-lg border-2 border-line bg-white px-2 py-1.5 outline-none focus:border-ink">
            {[0, 10, 12, 13, 15].map((v) => (
              <option key={v} value={v}>
                {v ? `${v}%` : "sem"}
              </option>
            ))}
          </select>
        </label>
      </div>

      {bill.mode === "igual" ? (
        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold">Valor da conta (sem o serviço)</p>
          <Money key={`t-${racha.id}`} cents={bill.totalCents} onChange={setTotal} label="Valor da conta" className="max-w-56" />
        </div>
      ) : (
        <>
          <ul className="mt-5 space-y-3">
            {bill.items.map((it) => {
              const eaters = it.people.length ? it.people : bill.people.map((p) => p.id);
              return (
                <li key={it.id} className="anim-pop rounded-xl border-2 border-line bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      defaultValue={it.name}
                      onChange={(e) => updateItem(it.id, { name: e.target.value.slice(0, 40) })}
                      placeholder="O que foi?"
                      aria-label="Item"
                      className="min-w-0 flex-1 basis-40 bg-transparent font-semibold outline-none placeholder:text-muted/70"
                    />
                    <div className="flex items-center rounded-lg border-2 border-line">
                      <button type="button" aria-label="Menos um" onClick={() => updateItem(it.id, { qty: Math.max(1, it.qty - 1) })} className="p-1.5 text-muted hover:text-ink">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="num w-7 text-center text-sm">{it.qty}</span>
                      <button type="button" aria-label="Mais um" onClick={() => updateItem(it.id, { qty: Math.min(99, it.qty + 1) })} className="p-1.5 text-muted hover:text-ink">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Money key={`m-${it.id}`} cents={it.cents} onChange={(cents) => updateItem(it.id, { cents })} label={`Preço de ${it.name || "item"}`} className="w-32" />
                    <button type="button" onClick={() => removeItem(it.id)} aria-label="Tirar item" className="rounded-lg p-1.5 text-muted hover:text-tomato">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {bill.people.length > 1 && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-xs text-muted">quem consumiu:</span>
                      {bill.people.map((p) => {
                        const on = eaters.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleEater(it.id, p.id)}
                            aria-pressed={on}
                            className={`flex items-center gap-1 rounded-full border py-0.5 pl-0.5 pr-2 text-xs font-semibold transition ${on ? "border-ink bg-paper" : "border-line text-muted opacity-60"}`}
                          >
                            <Avatar name={p.name} color={on ? colorOf(racha, p.id) : "#b9b2a4"} size={18} />
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => addItem()} className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-lime px-3.5 py-1.5 text-sm font-semibold transition hover:-translate-y-0.5">
              <Plus className="h-4 w-4" /> Item
            </button>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => addItem(p.name)}
                className="rounded-full border-2 border-line bg-white px-3 py-1.5 text-sm transition hover:-translate-y-0.5 hover:border-ink"
              >
                {p.emoji} {p.name}
              </button>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function Payee() {
  const { racha, setPayee } = useRacha();
  const { payee } = racha;
  const err = payee.key ? keyError(payee.key, payee.keyType) : null;
  return (
    <Card n={3} title="Pra quem vai o Pix?" hint="A chave fica só no link e no seu navegador. Nada passa por servidor.">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Nome de quem recebe</span>
          <input value={payee.name} onChange={(e) => setPayee({ name: e.target.value.slice(0, 40) })} placeholder="Como aparece no banco" className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Cidade</span>
          <input value={payee.city} onChange={(e) => setPayee({ city: e.target.value.slice(0, 40) })} placeholder="Ribeirão Preto" className={input} />
        </label>
        <div className="sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold">Chave Pix</span>
          <div className="flex gap-2">
            <input
              value={payee.key}
              onChange={(e) => setPayee({ key: e.target.value.slice(0, 80) })}
              placeholder="Celular, CPF, e-mail ou chave aleatória"
              aria-invalid={!!err}
              className={`${input} ${err ? "border-tomato" : ""}`}
            />
            <select
              value={payee.keyType}
              onChange={(e) => setPayee({ keyType: e.target.value as KeyType })}
              aria-label="Tipo da chave"
              className="shrink-0 rounded-xl border-2 border-line bg-white px-2 text-sm outline-none focus:border-ink"
            >
              {(Object.keys(KEY_LABEL) as KeyType[]).map((k) => (
                <option key={k} value={k}>
                  {KEY_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          {err && <p className="mt-1.5 text-sm text-tomato-dark">{err}</p>}
        </div>
      </div>
    </Card>
  );
}

export function Editor() {
  const { racha, setTitle } = useRacha();
  return (
    <div className="space-y-5">
      <label className="block">
        <span className="sr-only">Nome do rolê</span>
        <input
          value={racha.title}
          onChange={(e) => setTitle(e.target.value.slice(0, 60))}
          placeholder="Nome do rolê (ex.: Pizza de sexta)"
          className="w-full rounded-2xl border-2 border-dashed border-ink/40 bg-transparent px-4 py-3 text-xl font-bold outline-none placeholder:text-muted/70 focus:border-ink"
        />
      </label>
      <People />
      <Items />
      <Payee />
    </div>
  );
}
