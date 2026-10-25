import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isNfceUrl, notaToItems, parseNfce } from "./nfce";

const html = readFileSync(join(__dirname, "fixtures", "nfce-padrao.html"), "utf8");

describe("nota fiscal (NFC-e)", () => {
  it("só aceita link da consulta das Fazendas", () => {
    expect(isNfceUrl("https://www.nfce.fazenda.sp.gov.br/qrcode?p=35261011222333000181650010000012341000012345|2|1|1|ABC")).toBe(true);
    expect(isNfceUrl("http://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=43")).toBe(true);
    expect(isNfceUrl("https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml?p=31")).toBe(true);
    expect(isNfceUrl("https://evil.com/?fazenda.sp.gov.br")).toBe(false);
    expect(isNfceUrl("https://www.gov.br/receitafederal")).toBe(false);
    expect(isNfceUrl("http://localhost:3000")).toBe(false);
    expect(isNfceUrl("javascript:alert(1)")).toBe(false);
  });

  it("lê itens, quantidades, preços, loja e totais", () => {
    const nota = parseNfce(html)!;
    expect(nota.store).toBe("BAR E RESTAURANTE DO ZÉ & FILHOS LTDA");
    expect(nota.items).toHaveLength(4);
    expect(nota.items[0]).toEqual({ name: "CERVEJA PILSEN 600ML", qty: 6, unit: "UN", unitCents: 1290, totalCents: 7740 });
    expect(nota.items[2]).toMatchObject({ name: "PICANHA KG", qty: 0.535, unit: "KG", totalCents: 6415 });
    expect(nota).toMatchObject({ totalCents: 19205, discountCents: 205, paidCents: 19000 });
  });

  it("vira itens do racha fechando no valor pago", () => {
    const items = notaToItems(parseNfce(html)!);
    expect(items.reduce((s, it) => s + it.cents * it.qty, 0)).toBe(19000);
    expect(items[0].name).toBe("6× Cerveja Pilsen 600ml");
    expect(items[2].name).toBe("Picanha Kg (0,535 kg)");
    expect(items[1].name).toBe("Porcao de Fritas");
  });

  it("sem desconto, mantém quantidade e preço unitário", () => {
    const nota = parseNfce(
      html
        .replace('<label>Descontos R$:</label><span class="totalNumb">2,05</span>', '<label>Descontos R$:</label><span class="totalNumb">0,00</span>')
        .replace('<span class="totalNumb txtMax">190,00</span>', '<span class="totalNumb txtMax">192,05</span>'),
    )!;
    expect(nota.discountCents).toBe(0);
    const items = notaToItems(nota);
    expect(items[0]).toEqual({ name: "Cerveja Pilsen 600ml", cents: 1290, qty: 6 });
    expect(items[2]).toEqual({ name: "Picanha Kg (0,535 kg)", cents: 6415, qty: 1 });
  });

  it("página sem itens (captcha, erro, outro layout) devolve nada", () => {
    expect(parseNfce("<html><body>Digite o código da imagem</body></html>")).toBeNull();
  });
});
