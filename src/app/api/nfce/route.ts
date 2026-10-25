import { isNfceUrl, notaToItems, parseNfce } from "@/lib/nfce";

// Busca a consulta pública da NFC-e na Sefaz (o navegador não consegue, por CORS) e devolve os itens.
// Só aceita links das Fazendas estaduais. As funções rodam em São Paulo (vercel.json), porque algumas Sefaz
// recusam acesso de fora do Brasil.

const MAX_BYTES = 3_000_000;

function charsetOf(res: Response, head: string) {
  const fromHeader = res.headers.get("content-type")?.match(/charset=([\w-]+)/i)?.[1];
  const fromMeta = head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  return (fromHeader || fromMeta || "utf-8").toLowerCase();
}

const fail = (status: number, error: string) => Response.json({ error }, { status });

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url") ?? "";
  if (!isNfceUrl(url)) return fail(400, "Esse QR Code não é de uma nota fiscal (NFC-e).");

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Racha/1.0; +https://github.com/Bleachless/racha-pix)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
  } catch {
    return fail(502, "A Sefaz não respondeu agora. Tenta de novo daqui a pouco.");
  }
  if (!isNfceUrl(res.url || url)) return fail(400, "A consulta foi parar fora da Sefaz.");
  if (!res.ok) return fail(502, `A Sefaz respondeu com erro (${res.status}).`);

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return fail(502, "A página da nota veio grande demais.");
  const head = new TextDecoder("latin1").decode(buf.slice(0, 4096));
  let html: string;
  try {
    html = new TextDecoder(charsetOf(res, head)).decode(buf);
  } catch {
    html = new TextDecoder("utf-8").decode(buf);
  }

  const nota = parseNfce(html);
  if (!nota && /inv[aá]lid/i.test(html)) {
    return fail(422, "A Sefaz disse que esse QR Code é inválido. Se a nota acabou de sair, ela pode levar alguns minutos para aparecer na consulta.");
  }
  if (!nota) {
    return fail(422, "Não consegui ler os itens dessa nota: a Sefaz do seu estado pode pedir captcha ou usar outro formato. Lança os itens na mão.");
  }
  return Response.json({ nota, items: notaToItems(nota) });
}
