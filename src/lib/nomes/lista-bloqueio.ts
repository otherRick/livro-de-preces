// =====================================================================
// Lista inicial de bloqueio (pt-BR): ponto de partida CONSERVADOR.
//
// Acertar um termo NÃO rejeita o nome: ele vai para a quarentena silenciosa
// (só quem escreveu vê) e você revisa depois. Por isso, prefira errar para
// menos: nome de gente de verdade nunca deve ser barrado por engano.
//
// Escreva os termos em minúsculas e sem acento. Na comparação, a entrada
// também é normalizada (sem acento, minúscula, letras repetidas viram uma).
//
// Ficaram DE FORA de propósito, por serem sobrenomes ou nomes reais:
// pinto, bunda, preto, negro, mata, morra, pau, pica, rola, cu, bet, corno.
// Se algo assim for abusado, o caminho é a denúncia + revisão, não a lista.
//
// Cresça esta lista olhando a quarentena e as denúncias, não por palpite.
// =====================================================================

/** Termos longos (6+ letras) procurados DENTRO do texto colado, sem espaços.
 *  Pegam "p.u.t.a"-style e "filho da puta". Só coloque aqui o que é
 *  inequívoco: a busca atravessa fronteiras de palavras. */
export const TERMOS_FORTES: string[] = [
  "filhodaputa", "vagabundo", "vagabunda", "arrombado", "arrombada",
  "desgracado", "desgracada", "estuprador", "estupro", "pedofilo",
  "punheta", "punheteiro", "siririca", "caralho", "buceta", "boceta",
  "crioulo", "crioula", "nazista", "retardado", "mongoloide", "aleijado",
  "traveco", "sapatao",
];

/** Palavras inteiras (uma palavra do nome igual ao termo). */
export const PALAVRAS: string[] = [
  // palavrões
  "puta", "puto", "putinha", "putona", "putaria", "foda", "fodase", "foder",
  "fodido", "fodida", "fdp", "vsf", "pqp", "tnc", "merda", "merdinha",
  "bosta", "bostinha", "cagao", "cacete", "cuzao", "cuzinho", "xoxota",
  "xereca", "ppk", "punheta", "otario", "otaria", "babaca", "idiota",
  "imbecil", "cretino", "tarado", "tarada", "cornudo", "vadia", "prostituta",
  "desgraca", "lascar",
  // preconceito e ofensas a grupos
  "macaco", "macaca", "viado", "viadinho", "viadao", "veado", "bicha",
  "boiola", "sapatao",
  // ódio e violência
  "hitler", "nazi", "kkk", "morrer", "odeio", "odio", "matar", "verme",
  "escoria", "lixo", "nojento", "nojenta", "vai",
];

/** Palavras típicas de propaganda, links e contato. */
export const SPAM: string[] = [
  "www", "http", "https", "com", "br", "org", "net", "site", "link",
  "clique", "compre", "comprar", "venda", "vendo", "promocao", "ganhe",
  "gratis", "desconto", "oferta", "cassino", "aposta", "apostas",
  "tigrinho", "pix", "whatsapp", "zap", "zapzap", "telegram", "instagram",
  "insta", "tiktok", "facebook", "youtube", "ligue", "contato",
];
