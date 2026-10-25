import { describe, expect, it } from "vitest";
import { crc16, detectKey, keyError, normalizeKey, parseTlv, pixPayload, validCnpj, validCpf } from "./pix";
import { decodeRacha, encodeRacha, type Racha } from "./share";
import { allocate, computeShares, grandTotal, parseMoney, type Bill } from "./split";

describe("pix", () => {
  it("bate com o exemplo do manual do Banco Central", () => {
    const body =
      "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304";
    expect(crc16(body)).toBe("1D3D");
  });

  it("monta o código com valor, nome sem acento e CRC certo", () => {
    const code = pixPayload({ key: "+5516991234567", name: "João Vaz", city: "Ribeirão Preto", cents: 4250, txid: "racha-01" });
    const f = parseTlv(code);
    expect(f["00"]).toBe("01");
    expect(parseTlv(f["26"])).toEqual({ "00": "br.gov.bcb.pix", "01": "+5516991234567" });
    expect(f["54"]).toBe("42.50");
    expect(f["59"]).toBe("JOAO VAZ");
    expect(f["60"]).toBe("RIBEIRAO PRETO");
    expect(parseTlv(f["62"])["05"]).toBe("racha01");
    expect(code.slice(-4)).toBe(crc16(code.slice(0, -4)));
  });

  it("sem valor, o campo 54 fica de fora", () => {
    expect(parseTlv(pixPayload({ key: "a@b.com", name: "A", city: "B" }))["54"]).toBeUndefined();
  });

  it("reconhece o tipo de chave", () => {
    expect(detectKey("fulano@email.com")).toBe("email");
    expect(detectKey("123e4567-e12b-12d1-a456-426655440000")).toBe("random");
    expect(detectKey("529.982.247-25")).toBe("cpf");
    expect(detectKey("11.222.333/0001-81")).toBe("cnpj");
    expect(detectKey("(16) 99123-4567")).toBe("phone");
    expect(detectKey("16991234567")).toBe("phone"); // 11 dígitos que não fecham como CPF
    expect(detectKey("abc")).toBeNull();
  });

  it("normaliza e valida as chaves", () => {
    expect(normalizeKey("(16) 99123-4567", "phone")).toBe("+5516991234567");
    expect(normalizeKey("+55 16 99123-4567", "phone")).toBe("+5516991234567");
    expect(normalizeKey("529.982.247-25", "cpf")).toBe("52998224725");
    expect(validCpf("52998224725")).toBe(true);
    expect(validCpf("11111111111")).toBe(false);
    expect(validCnpj("11222333000181")).toBe(true);
    expect(keyError("123", "cpf")).toMatch(/CPF/);
    expect(keyError("(16) 99123-4567", "phone")).toBeNull();
  });
});

describe("divisão", () => {
  it("o maior resto fecha no centavo", () => {
    expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    expect(allocate(100, [1, 3])).toEqual([25, 75]);
    expect(allocate(0, [1, 1])).toEqual([0, 0]);
  });

  const people = [
    { id: "a", name: "Ana" },
    { id: "b", name: "Bia" },
    { id: "c", name: "Caio" },
  ];

  it("igual pra todo mundo, com serviço", () => {
    const bill: Bill = { mode: "igual", people, items: [], totalCents: 10000, service: 10 };
    const s = computeShares(bill);
    expect(grandTotal(bill)).toBe(11000);
    expect(s.reduce((x, y) => x + y.cents, 0)).toBe(11000);
    expect(s.map((x) => x.cents)).toEqual([3667, 3667, 3666]);
  });

  it("por item: cada um paga o que consumiu e o serviço é proporcional", () => {
    const bill: Bill = {
      mode: "itens",
      people,
      items: [
        { id: "1", name: "Pizza", cents: 9000, qty: 1, people: [] },
        { id: "2", name: "Cerveja", cents: 1200, qty: 5, people: ["a", "b"] },
        { id: "3", name: "Suco", cents: 999, qty: 1, people: ["c"] },
      ],
      totalCents: 0,
      service: 10,
    };
    const s = computeShares(bill);
    const total = grandTotal(bill);
    expect(total).toBe(Math.round((9000 + 6000 + 999) * 1.1));
    expect(s.reduce((x, y) => x + y.cents, 0)).toBe(total);
    const [ana, bia, caio] = s;
    expect(ana.cents).toBe(bia.cents);
    expect(caio.parts.map((p) => p.label)).toEqual(["Pizza", "Suco", "Serviço (10%)"]);
    expect(ana.parts[1]).toEqual({ label: "5× Cerveja", cents: 3000 });
  });

  it("entende valores escritos de vários jeitos", () => {
    expect(parseMoney("12,50")).toBe(1250);
    expect(parseMoney("R$ 1.234,56")).toBe(123456);
    expect(parseMoney("12.5")).toBe(1250);
    expect(parseMoney("1.500")).toBe(150000);
    expect(parseMoney("")).toBe(0);
    expect(parseMoney("-3")).toBe(0);
  });
});

describe("link", () => {
  it("ida e volta sem perder nada", () => {
    const r: Racha = {
      id: "x1",
      title: "Churrasco de sábado",
      date: "2026-10-25",
      bill: {
        mode: "itens",
        people: [
          { id: "p1", name: "João" },
          { id: "p2", name: "Maria" },
        ],
        items: [{ id: "i0", name: "Carne", cents: 15000, qty: 1, people: ["p2"] }],
        totalCents: 0,
        service: 0,
      },
      payee: { name: "João Vaz", key: "+5516991234567", keyType: "phone", city: "Ribeirão Preto" },
      payerId: "p1",
    };
    const back = decodeRacha(encodeRacha(r));
    expect(back).toEqual(r);
  });

  it("link quebrado não derruba a página", () => {
    expect(decodeRacha("lixo")).toBeNull();
    expect(decodeRacha("")).toBeNull();
  });
});
