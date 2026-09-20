# Livro de Orações Online

Aplicação web anônima, mobile first, de página única: um "livro" onde qualquer pessoa escreve nomes de pessoas a quem dedica aspirações e homenagens (prática budista dos livros dos vivos e dos mortos, feita no puja da manhã). Sem login, sem senha, sem identificação. Tom: acolhedor e calmo; ninguém é punido.

## Onde está a verdade
- `docs/projeto.md`: decisões e motivos. Leia antes de mudar qualquer regra de produto.
- `prototipo/layout.html`: referência EXATA da experiência (layout, interação, textos). Reproduza fielmente, não redesenhe.
- `db/schema.sql`: esquema Postgres/Supabase (ainda NÃO testado; ver `docs/tarefas.md`).
- `src/lib/nomes/`: validação de nomes e lista de bloqueio, com testes.
- `docs/tarefas.md`: ordem de trabalho e critérios de aceite.

## Regras que só mudam com aprovação do dono do projeto

### Experiência
- Duas abas: Vivos e Mortos. Cada página é uma tela inteira com 12 linhas; deslize horizontal com `scroll-snap`; abre na última página; setas visíveis e "Página X de N"; data no topo de cada página.
- A página é limpa: só abas, data, pauta e nomes. Nenhum botão de denúncia visível.
- Campo de escrita separado do livro, fixo embaixo, com botão "Escrever". O nome vai para a próxima linha livre; ao encher a página, a nova desliza para dentro.
- Só se acrescenta: ninguém edita nem apaga nomes. Única exceção: "Desfazer" por 60 s, só para a sessão que escreveu (remove se ainda for a última linha; senão deixa a linha em branco).
- Denunciar: tocar num nome abre uma folha inferior (Denunciar / Cancelar).
- Sem animações além do deslize. Nostalgia de caderno de pauta só com CSS, sem imagens pesadas.
- Público mais velho: letra grande, alto contraste, botões de pelo menos 48px, campo de texto com fonte de 16px ou mais, poucos passos.

### Moderação (o dono quer gastar 5 a 10 min por semana)
- Formato "cara de nome": 2 a 40 caracteres, até 6 palavras, alfabeto latino, ponto só em abreviaturas. Tudo texto puro (nunca HTML), sem links clicáveis, `noindex`.
- Termo da lista de bloqueio leva à quarentena SILENCIOSA: só o autor vê (por sessão, não por IP), não ocupa linha, sem aviso e sem punição.
- A lista de bloqueio é CONSERVADORA. Nunca inclua sobrenomes reais (Pinto, Mata, Bunda, Preto...). Ela cresce a partir da quarentena, não por palpite.
- 3 denúncias de IPs distintos ocultam a entrada até revisão. Botão de emergência: `somente_leitura` na tabela `configuracao`.
- Pedidos de remoção (por e-mail) são sempre atendidos, com exclusão definitiva.

### Segurança e privacidade
- O navegador NUNCA acessa o banco. Tudo passa por rotas de servidor que chamam as funções SQL com a `service_role` key, que só existe em variável de ambiente do servidor.
- Sessão anônima = token aleatório em cookie; no banco fica só o HMAC (segredo do servidor). IP só como HMAC, apenas para rate limit (20 por hora) e denúncias.
- Cloudflare Turnstile (uma vez por sessão), campo isca (honeypot), validação no cliente E no servidor.
- LGPD: sem contas nem e-mails; texto curto de finalidade e e-mail de remoção. Exibição: vivos 90 dias, mortos 49; exclusão definitiva 90 dias depois (valores em `configuracao`; ainda a confirmar).

### Custo: tudo gratuito
- Vercel Hobby (uso não comercial: sem anúncios nem doações), Supabase free, Turnstile grátis. IA de moderação é opcional e nunca pode ser dependência.
- Supabase free pausa por inatividade e não tem backup automático: ping agendado e export semanal.

## Stack
SvelteKit 2 com TypeScript e Svelte 5, `adapter-vercel`, PWA, CSS puro (sem framework de estilo), Supabase (Postgres + pg_cron), Vercel.

## Como trabalhar
- Faça a primeira tarefa pendente de `docs/tarefas.md`. Não pule etapas.
- Mudou uma decisão? Atualize `docs/projeto.md` na mesma alteração.
- Mexeu em `src/lib/nomes/`? Rode os testes.
- Não invente regra de produto: pergunte.

## Comandos
| O quê | Comando |
|---|---|
| Instalar | `npm install` |
| Rodar em dev | `npm run dev` (http://localhost:5173) |
| Testes dos nomes | `npm test` (42 casos) |
| Verificação de tipos | `npm run lint` (`svelte-check`) |
| Build de produção | `npm run build` |
| Ver o build | `npm run preview` |
