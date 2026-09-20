// Rodar:  npx tsx --test src/lib/nomes/validar-nome.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { validarNome } from "./validar-nome";

// [entrada, esperado]  esperado = "visivel" | "quarentena" | erro de formato
const casos: [string, string, string?][] = [
  // --- nomes legítimos: devem ficar visíveis (3º item = texto final esperado) ---
  ["José da Conceição", "visivel", "José da Conceição"],
  ["D'Ávila Nguyễn", "visivel", "D'Ávila Nguyễn"],
  ["Ma. Helena de Souza-Lima", "visivel", "Ma. Helena de Souza-Lima"],
  ["maria da silva", "visivel", "Maria da Silva"],
  ["JOÃO BATISTA", "visivel", "João Batista"],
  ["Ven. Thubten Chodron", "visivel"],
  ["Lama Padma Samten", "visivel"],
  ["J. R. R. Tolkien", "visivel"],
  ["Ana Pinto", "visivel"],          // sobrenomes que NÃO devem ser barrados
  ["Carlos Bunda", "visivel"],
  ["Rosa Mata", "visivel"],
  ["Bet Souza", "visivel"],
  ["Aleijadinho", "visivel"],
  ["Que todos sejam felizes", "visivel"],
  ["Ana\nMaria", "visivel", "Ana Maria"],

  // --- formato inválido ---
  ["", "vazio"],
  ["    ", "vazio"],
  ["a", "formato"],
  ["Fulano 123", "formato"],
  ["@fulano", "formato"],
  ["Maria 😀", "formato"],
  ["compre em www.site.com", "formato"],   // ponto no meio da palavra
  ["Fulano.com", "formato"],
  ["Antonio Fulano.", "formato"],          // ponto em palavra que não é abreviatura
  ["Dr. Dr. Dr. Dr. Ana", "formato"],      // pontos demais
  ["Aaaaaaa", "formato"],
  ["Иван", "formato"],                     // só alfabeto latino (por enquanto)
  ["Silva-", "formato"],
  ["Ana Maria Silva Souza Santos Lima Costa", "muito_longo"],
  ["Anastácio Bartolomeu de Albuquerque Cavalcanti", "muito_longo"],

  // --- termos bloqueados: quarentena silenciosa ---
  ["Fulano Puta", "quarentena"],
  ["Filho da Puta", "quarentena"],
  ["Fulano Puuuta", "quarentena"],         // letras repetidas
  ["p u t a", "quarentena"],               // letras soltas
  ["F D P", "quarentena"],
  ["Cárálho", "quarentena"],               // acento no meio
  ["CARALHO", "quarentena"],
  ["Vai Se Lascar", "quarentena"],
  ["Hitler", "quarentena"],
  ["Whatsapp Fulano", "quarentena"],
  ["Compre Agora", "quarentena"],
];

for (const [entrada, esperado, textoFinal] of casos) {
  test(`${JSON.stringify(entrada)} -> ${esperado}`, () => {
    const r = validarNome(entrada);
    if (esperado === "visivel" || esperado === "quarentena") {
      assert.equal(r.ok, true, JSON.stringify(r));
      if (r.ok) {
        assert.equal(r.destino, esperado, `motivo: ${r.motivo}`);
        if (textoFinal) assert.equal(r.texto, textoFinal);
      }
    } else {
      assert.deepEqual(r.ok ? r : { ok: false, erro: (r as any).erro }, { ok: false, erro: esperado });
    }
  });
}

test("entrada que não é texto", () => {
  assert.equal(validarNome(123 as unknown).ok, false);
});
