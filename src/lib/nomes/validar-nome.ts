// =====================================================================
// Validação de nomes (roda NO SERVIDOR antes de chamar registrar_entrada).
// A mesma regra de formato existe como CHECK no banco, como rede de segurança;
// aqui ela é um pouco mais estrita (só alfabeto latino, sem ponto no meio da
// palavra etc.) e dá mensagens amigáveis.
//
// Dois tipos de resultado:
//  * Formato inválido  -> recusa com mensagem gentil (a pessoa corrige).
//  * Termo bloqueado   -> destino "quarentena" (SILENCIOSO: a pessoa vê o nome
//    na própria tela e ninguém mais vê; sem aviso, sem punição).
// =====================================================================
import { PALAVRAS, SPAM, TERMOS_FORTES } from "./lista-bloqueio";

export const LIMITES = {
  maxChars: 40,
  maxPalavras: 6,
  maxLetrasPorPalavra: 20,
  maxPontos: 3,            // só em abreviaturas: "Ma.", "Dr.", "J. R. R."
  maxLetrasAbreviatura: 4, // "Profa." ok; "Fulano." não
  maxRepeticao: 3,         // "Aaaa" (4 iguais seguidas) é recusado
} as const;

export const MENSAGENS_ERRO = {
  vazio: "Escreva um nome.",
  muito_longo: "Use até 40 letras e 6 palavras.",
  formato: "Escreva só o nome, usando letras.",
} as const;

export type Resultado =
  | { ok: false; erro: keyof typeof MENSAGENS_ERRO }
  | { ok: true; texto: string; destino: "visivel" | "quarentena"; motivo: string | null };

const CONECTORES = new Set([
  "da", "de", "do", "das", "dos", "e", "di", "du", "del", "della",
  "van", "von", "bin", "ibn", "al", "el", "la", "le",
]);

const INVISIVEIS = /[\u00AD\u200B-\u200F\u2060\uFEFF]/g;
const L = "\\p{Script=Latin}";
const PALAVRA_OK = new RegExp(`^${L}+(?:['-]${L}+)*\\.?$`, "u");
const REPETICAO = new RegExp(`(\\p{L})\\1{${LIMITES.maxRepeticao},}`, "iu");

/** Normaliza para comparar: sem acento, minúsculas, letras repetidas -> uma. */
function chave(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/(\p{L})\1+/gu, "$1");
}

const SET_PALAVRAS = new Set(PALAVRAS.map(chave));
const SET_SPAM = new Set(SPAM.map(chave));
const LISTA_FORTES = TERMOS_FORTES.map(chave);

/** Limpeza: NFC, remove caracteres invisíveis, aspas curvas -> ', espaços e quebras -> 1 espaço. */
function limpar(bruto: string): string {
  return bruto
    .normalize("NFC")
    .replace(INVISIVEIS, "")
    .replace(/[’‘´`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ex.: "Maria da SILVA" -> só ajusta se veio TUDO minúsculo ou TUDO maiúsculo. */
export function formatarNome(texto: string): string {
  const baixo = texto.toLocaleLowerCase("pt-BR");
  const tudoMin = texto === baixo;
  const tudoMai = texto === texto.toLocaleUpperCase("pt-BR");
  if (!tudoMin && !tudoMai) return texto;

  return baixo
    .split(" ")
    .map((p, i) =>
      i > 0 && CONECTORES.has(p)
        ? p
        : p.replace(/(^|['-])(\p{L})/gu, (_m, a: string, l: string) => a + l.toLocaleUpperCase("pt-BR")),
    )
    .join(" ");
}

/** Devolve o motivo (ex.: "filtro:puta") ou null se estiver limpo. */
function analisarTermos(texto: string): string | null {
  const k = chave(texto);
  const tokens = k.split(/[^\p{L}]+/u).filter(Boolean);

  // Junta letras soltas seguidas: "p u t a" -> "puta", "f d p" -> "fdp"
  const extras: string[] = [];
  let corrida = "";
  for (const t of [...tokens, ""]) {
    if (t.length === 1) corrida += t;
    else {
      if (corrida.length >= 2) extras.push(corrida);
      corrida = "";
    }
  }

  for (const t of [...tokens, ...extras]) {
    if (SET_PALAVRAS.has(t)) return `filtro:${t}`;
    if (SET_SPAM.has(t)) return `spam:${t}`;
  }

  const colado = k.replace(/[^\p{L}]/gu, "");
  for (const f of LISTA_FORTES) {
    if (colado.includes(f)) return `filtro:${f}`;
  }
  return null;
}

export function validarNome(bruto: unknown): Resultado {
  if (typeof bruto !== "string") return { ok: false, erro: "formato" };
  if (bruto.length > 200) return { ok: false, erro: "muito_longo" }; // corta abuso antes de processar

  const t = limpar(bruto);
  if (t.length === 0) return { ok: false, erro: "vazio" };

  const palavras = t.split(" ");
  if (t.length > LIMITES.maxChars || palavras.length > LIMITES.maxPalavras) {
    return { ok: false, erro: "muito_longo" };
  }
  if (t.length < 2) return { ok: false, erro: "formato" };

  let pontos = 0;
  for (const p of palavras) {
    if (!PALAVRA_OK.test(p)) return { ok: false, erro: "formato" };
    const letras = p.replace(/[^\p{L}]/gu, "").length;
    if (letras > LIMITES.maxLetrasPorPalavra) return { ok: false, erro: "formato" };
    if (p.endsWith(".")) {
      pontos++;
      if (letras > LIMITES.maxLetrasAbreviatura) return { ok: false, erro: "formato" };
    }
  }
  if (pontos > LIMITES.maxPontos) return { ok: false, erro: "formato" };
  if (REPETICAO.test(t)) return { ok: false, erro: "formato" };

  const texto = formatarNome(t);
  const motivo = analisarTermos(texto);
  return { ok: true, texto, destino: motivo ? "quarentena" : "visivel", motivo };
}
