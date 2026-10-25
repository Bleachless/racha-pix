// "Pix copia e cola" estático no padrão BR Code (EMV QRCPS-MPM), sem precisar de banco nem API.
// Manual de Padrões para Iniciação do Pix, do Banco Central.

export type KeyType = "cpf" | "cnpj" | "phone" | "email" | "random";

export const KEY_LABEL: Record<KeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  phone: "Celular",
  email: "E-mail",
  random: "Chave aleatória",
};

const onlyDigits = (s: string) => s.replace(/\D/g, "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validCpf(value: string) {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const check = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
}

export function validCnpj(value: string) {
  const d = onlyDigits(value);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const check = (len: number) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = w.reduce((s, x, i) => s + x * Number(d[i]), 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return check(12) === Number(d[12]) && check(13) === Number(d[13]);
}

// Descobre o tipo da chave pelo formato. Onze dígitos podem ser CPF ou celular: vale o CPF se o dígito bater.
export function detectKey(raw: string): KeyType | null {
  const v = raw.trim();
  if (!v) return null;
  if (EMAIL.test(v)) return "email";
  if (UUID.test(v)) return "random";
  const d = onlyDigits(v);
  if (/^\+/.test(v) || /^\(\d{2}\)/.test(v)) return d.length >= 10 ? "phone" : null;
  if (d.length === 14 && validCnpj(d)) return "cnpj";
  if (d.length === 11 && validCpf(d)) return "cpf";
  if (d.length === 10 || d.length === 11 || ((d.length === 12 || d.length === 13) && d.startsWith("55"))) return "phone";
  return null;
}

// Formato que vai dentro do código: CPF/CNPJ só números, celular +55DDDNÚMERO, e-mail minúsculo.
export function normalizeKey(raw: string, type: KeyType): string {
  const v = raw.trim();
  switch (type) {
    case "cpf":
    case "cnpj":
      return onlyDigits(v);
    case "phone": {
      const d = onlyDigits(v);
      return d.length >= 12 && d.startsWith("55") ? `+${d}` : `+55${d}`;
    }
    case "email":
      return v.toLowerCase();
    case "random":
      return v.toLowerCase();
  }
}

export function keyError(raw: string, type: KeyType): string | null {
  const v = raw.trim();
  if (!v) return "Coloca a chave Pix de quem vai receber.";
  if (type === "cpf" && !validCpf(v)) return "Esse CPF não parece válido.";
  if (type === "cnpj" && !validCnpj(v)) return "Esse CNPJ não parece válido.";
  if (type === "email" && !EMAIL.test(v)) return "Esse e-mail não parece válido.";
  if (type === "random" && !UUID.test(v)) return "A chave aleatória tem o formato 0000aaaa-00aa-…";
  if (type === "phone") {
    const n = normalizeKey(v, "phone");
    if (!/^\+55\d{10,11}$/.test(n)) return "Celular com DDD, ex.: (16) 99123-4567.";
  }
  return null;
}

// Nome e cidade vão sem acento, em maiúsculas e com tamanho limitado, como o padrão pede.
export function clean(text: string, max: number) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, max)
    .trim();
}

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

export function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export type PixInput = {
  key: string; // já normalizada
  name: string;
  city: string;
  cents?: number;
  txid?: string;
  message?: string;
};

export function pixPayload({ key, name, city, cents, txid, message }: PixInput) {
  const info = clean(message ?? "", 40);
  const base = field("00", "br.gov.bcb.pix") + field("01", key);
  // A mensagem é opcional e o campo 26 tem no máximo 99 caracteres: com chave longa, ela sai.
  const account = info && base.length + 4 + info.length <= 99 ? base + field("02", info) : base;
  const id = (txid ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const body =
    field("00", "01") +
    field("26", account) +
    field("52", "0000") +
    field("53", "986") +
    (cents && cents > 0 ? field("54", (cents / 100).toFixed(2)) : "") +
    field("58", "BR") +
    field("59", clean(name, 25) || "RECEBEDOR") +
    field("60", clean(city, 15) || "BRASIL") +
    field("62", field("05", id)) +
    "6304";
  return body + crc16(body);
}

// Lê os campos de um código (usado nos testes e para conferir o que foi gerado).
export function parseTlv(payload: string) {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < payload.length) {
    const id = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    out[id] = payload.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}
