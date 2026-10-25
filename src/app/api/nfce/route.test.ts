import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const html = readFileSync(join(__dirname, "..", "..", "..", "lib", "fixtures", "nfce-padrao.html"), "utf8");
const SP = "https://www.nfce.fazenda.sp.gov.br/qrcode?p=35261011222333000181650010000012341000012345|2|1|1|ABC";
const call = (url: string) => GET(new Request(`http://localhost/api/nfce?url=${encodeURIComponent(url)}`));

afterEach(() => vi.unstubAllGlobals());

describe("rota da nota fiscal", () => {
  it("busca na Sefaz, entende ISO-8859-1 e devolve os itens", async () => {
    const latin1 = Buffer.from(html, "latin1");
    const fetchMock = vi.fn(async () => {
      const res = new Response(latin1, { status: 200, headers: { "content-type": "text/html; charset=ISO-8859-1" } });
      Object.defineProperty(res, "url", { value: SP });
      return res;
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await call(SP);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(body.nota.store).toBe("BAR E RESTAURANTE DO ZÉ & FILHOS LTDA");
    expect(body.items).toHaveLength(4);
  });

  it("recusa link que não é de Sefaz sem nem buscar", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await call("https://exemplo.com/nota");
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Sefaz fora do ar ou com captcha vira mensagem clara", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("timeout"))));
    expect((await call(SP)).status).toBe(502);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const res = new Response("<html>Digite os caracteres da imagem</html>", { status: 200 });
        Object.defineProperty(res, "url", { value: SP });
        return res;
      }),
    );
    const res = await call(SP);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/Lança os itens na mão/);
  });

  it("chave que a Sefaz não reconhece tem aviso próprio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const res = new Response("<html><span>Chave de Acesso do QR Code inválido</span></html>", { status: 200 });
        Object.defineProperty(res, "url", { value: SP });
        return res;
      }),
    );
    const res = await call(SP);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/alguns minutos/);
  });
});
