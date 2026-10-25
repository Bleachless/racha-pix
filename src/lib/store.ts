"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { todayIso } from "./charge";
import { detectKey, type KeyType } from "./pix";
import type { Payee, Racha } from "./share";
import type { Item, Mode } from "./split";

export const uid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 8);

const blank = (): Racha => ({
  id: uid(),
  title: "",
  date: todayIso(),
  bill: { mode: "itens", people: [{ id: "eu", name: "Eu" }], items: [], totalCents: 0, service: 10 },
  payee: { name: "", key: "", keyType: "phone", city: "" },
  payerId: "eu",
});

// Exemplo para quem quer ver funcionando antes de digitar.
export function example(): Racha {
  const ids = ["eu", uid(), uid(), uid()];
  return {
    id: uid(),
    title: "Churrasco de sábado",
    date: todayIso(),
    bill: {
      mode: "itens",
      people: ["João", "Maria", "Pedro", "Bia"].map((name, i) => ({ id: ids[i], name })),
      items: [
        { id: uid(), name: "Picanha", cents: 18990, qty: 1, people: [] },
        { id: uid(), name: "Cerveja", cents: 549, qty: 12, people: [ids[0], ids[2], ids[3]] },
        { id: uid(), name: "Refri 2L", cents: 1199, qty: 1, people: [ids[1]] },
        { id: uid(), name: "Carvão e gelo", cents: 4500, qty: 1, people: [] },
      ],
      totalCents: 30000,
      service: 0,
    },
    payee: { name: "João Vaz", key: "(16) 99123-4567", keyType: "phone", city: "Ribeirão Preto" },
    payerId: "eu",
  };
}

type State = {
  racha: Racha;
  paid: Record<string, Record<string, boolean>>; // racha -> pessoa -> pagou
  me: Record<string, string>; // racha -> quem eu sou (na página do link)

  setTitle: (t: string) => void;
  addPerson: (name: string) => void;
  renamePerson: (id: string, name: string) => void;
  removePerson: (id: string) => void;
  setPayer: (id: string | null) => void;
  setMode: (m: Mode) => void;
  setTotal: (cents: number) => void;
  setService: (pct: number) => void;
  addItem: (name?: string, cents?: number) => void;
  updateItem: (id: string, patch: Partial<Item>) => void;
  toggleEater: (itemId: string, personId: string) => void;
  removeItem: (id: string) => void;
  setPayee: (patch: Partial<Payee>) => void;
  togglePaid: (rachaId: string, personId: string) => void;
  setMe: (rachaId: string, personId: string) => void;
  load: (r: Racha) => void;
  reset: () => void;
};

const bill = (s: State, patch: Partial<Racha["bill"]>) => ({ racha: { ...s.racha, bill: { ...s.racha.bill, ...patch } } });

export const useRacha = create<State>()(
  persist(
    (set) => ({
      racha: blank(),
      paid: {},
      me: {},

      setTitle: (title) => set((s) => ({ racha: { ...s.racha, title } })),
      addPerson: (name) =>
        set((s) => {
          const n = name.trim().slice(0, 30);
          return n ? bill(s, { people: [...s.racha.bill.people, { id: uid(), name: n }] }) : {};
        }),
      renamePerson: (id, name) => set((s) => bill(s, { people: s.racha.bill.people.map((p) => (p.id === id ? { ...p, name: name.slice(0, 30) } : p)) })),
      removePerson: (id) =>
        set((s) => ({
          racha: {
            ...s.racha,
            payerId: s.racha.payerId === id ? null : s.racha.payerId,
            bill: {
              ...s.racha.bill,
              people: s.racha.bill.people.filter((p) => p.id !== id),
              items: s.racha.bill.items.map((it) => ({ ...it, people: it.people.filter((x) => x !== id) })),
            },
          },
        })),
      setPayer: (payerId) => set((s) => ({ racha: { ...s.racha, payerId } })),
      setMode: (mode) => set((s) => bill(s, { mode })),
      setTotal: (totalCents) => set((s) => bill(s, { totalCents })),
      setService: (service) => set((s) => bill(s, { service })),
      addItem: (name = "", cents = 0) => set((s) => bill(s, { items: [...s.racha.bill.items, { id: uid(), name, cents, qty: 1, people: [] }] })),
      updateItem: (id, patch) => set((s) => bill(s, { items: s.racha.bill.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) })),
      toggleEater: (itemId, personId) =>
        set((s) =>
          bill(s, {
            items: s.racha.bill.items.map((it) => {
              if (it.id !== itemId) return it;
              // Lista vazia = todo mundo. Ao tirar alguém, a lista passa a ter os outros.
              const all = s.racha.bill.people.map((p) => p.id);
              const cur = it.people.length ? it.people : all;
              const next = cur.includes(personId) ? cur.filter((x) => x !== personId) : [...cur, personId];
              return { ...it, people: next.length === all.length || next.length === 0 ? [] : next };
            }),
          }),
        ),
      removeItem: (id) => set((s) => bill(s, { items: s.racha.bill.items.filter((it) => it.id !== id) })),
      setPayee: (patch) =>
        set((s) => {
          const payee = { ...s.racha.payee, ...patch };
          if (patch.key !== undefined && !("keyType" in patch)) payee.keyType = (detectKey(patch.key) ?? s.racha.payee.keyType) as KeyType;
          return { racha: { ...s.racha, payee } };
        }),
      togglePaid: (rachaId, personId) =>
        set((s) => ({ paid: { ...s.paid, [rachaId]: { ...s.paid[rachaId], [personId]: !s.paid[rachaId]?.[personId] } } })),
      setMe: (rachaId, personId) => set((s) => ({ me: { ...s.me, [rachaId]: personId } })),
      load: (racha) => set({ racha }),
      reset: () =>
        set((s) => ({
          // Começa um racha novo mas guarda quem recebe, que costuma ser sempre a mesma pessoa.
          racha: { ...blank(), payee: s.racha.payee },
        })),
    }),
    { name: "racha", version: 1 },
  ),
);

const noop = () => () => {};
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

function subscribeHash(cb: () => void) {
  addEventListener("hashchange", cb);
  return () => removeEventListener("hashchange", cb);
}
export function useHash() {
  return useSyncExternalStore(
    subscribeHash,
    () => location.hash.slice(1),
    () => "",
  );
}
