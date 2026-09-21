# Tarefas (ordem de execução)

Marque `[x]` ao concluir e registre em `docs/projeto.md` qualquer decisão nova.

## Prompt inicial (cole no Claude Code)

> Leia `CLAUDE.md`, `docs/projeto.md` e `docs/tarefas.md`, e abra `prototipo/layout.html` para ver a experiência de referência. Decisão tomada: SvelteKit com TypeScript, deploy na Vercel. Atualize a linha "Stack" do `CLAUDE.md` e a Tarefa 0 de `docs/tarefas.md` com essa decisão. Monte o projeto mantendo os arquivos existentes. Depois siga a ordem, uma tarefa por vez, e mostre como testar cada uma.

## 0. Base do projeto

- [x] **Decisão: SvelteKit 2 + TypeScript, deploy na Vercel (`adapter-vercel`).** Justificativa: o protótipo é HTML, CSS e DOM puros, e o Svelte compila para isso sem runtime de framework, então o porte da Tarefa 3 é quase cópia; as rotas de servidor (`+server.ts`) já são o lugar natural das chamadas com a `service_role` key, sem cliente no navegador; e o bundle menor ajuda o público-alvo em celular modesto.
- [x] Criar o projeto mantendo `db/`, `docs/`, `prototipo/`, `src/lib/nomes/`. Preencher a seção "Comandos" do `CLAUDE.md`.
- [x] `git init`, `.gitignore` (inclui `.env*`), `.env.example` (sem valores reais), commit inicial.
- **Aceite:** projeto sobe em dev; `npx tsx --test src/lib/nomes/validar-nome.test.ts` passa (42 casos). ✅ verificado: dev responde HTTP 200, 42 testes passam, `npm run build` e `npm run lint` limpos.

## 1. Banco (Supabase de teste)

- [x] Criar um projeto Supabase SEPARADO só para teste. Rodar a Parte 1 de `db/schema.sql`.
- [x] Corrigir erros que aparecerem (o script nunca foi executado) e rodar os testes do rodapé do arquivo. Conferir acentos ("José", "Conceição", "D'Ávila", "Nguyễn"). **Nenhuma correção foi necessária: a Parte 1 rodou limpa de primeira.**
- [x] Testar de verdade: quarentena não ocupa linha; aprovar dá a próxima linha; desfazer remove a última linha; 3 denúncias de IPs distintos ocultam; `somente_leitura` bloqueia.
- **Aceite:** script roda limpo; cenários acima verificados com SQL ou testes automatizados. ✅ `db/teste-cenarios.sql`: 14 cenários com `assert`, dentro de `begin … rollback`, todos passando no Supabase de teste.

## 2. Servidor (rotas)

- [ ] Sessão anônima: token aleatório em cookie httpOnly; no banco só o HMAC. IP também só como HMAC.
- [ ] `POST /api/escrever`: honeypot, Turnstile (uma vez por sessão), `validarNome`, `registrar_entrada` (status `visivel` ou `quarentena`). A resposta NÃO revela o motivo nem o filtro.
- [ ] `GET /api/livro/:livro` (`resumo_livro`) e `GET /api/livro/:livro/pagina/:n` (`ler_pagina`; na última página, incluir `minhas_quarentenas` da sessão).
- [ ] `POST /api/desfazer` e `POST /api/denunciar`.
- [ ] Mapear erros do banco: `somente_leitura`, `limite_excedido`, `formato_invalido`, `nao_permitido`.
- **Aceite:** testes de integração; a `service_role` key não aparece em nenhum código enviado ao navegador.

## 3. Front-end

- [ ] Portar `prototipo/layout.html` fielmente (abas, scroll-snap, setas, campo de escrita, folha de denúncia, desfazer, tema escuro, fonte manuscrita).
- [ ] Ligar às rotas. O autor vê os próprios nomes em quarentena ao fim do livro, como se estivessem escritos.
- **Aceite:** mesma experiência do protótipo em celular real (iPhone e Android), incluindo o teclado sem cobrir o campo de escrita.

## 4. Administração

- [ ] Página simples e protegida só para o dono: lista `revisao_pendente`, botões aprovar/ocultar (`moderar_entrada`), liga/desliga `somente_leitura`.

## 5. Texto legal

- [ ] Preencher "Sobre": finalidade, privacidade (nomes de terceiros, IP como hash, retenção) e e-mail de remoção. Revisar com um profissional.

## 6. Operação

- [ ] `pg_cron` (Parte 2 do schema), ping anti-pausa do Supabase, export semanal do banco para local do dono.
- [ ] Documentar variáveis de ambiente em `.env.example`.

## 7. Publicação

- [ ] PWA (manifest, ícones), `noindex`, domínio (opcional), deploy na Vercel Hobby.
