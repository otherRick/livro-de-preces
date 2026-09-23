# Livro de Orações Online: registro do projeto

> Documento de registro da ideia, da estrutura e das decisões tomadas até agora.
> Status: **conceito / pré-desenvolvimento**. Última atualização: 20/09/2026.

---

## 1. Visão

Uma aplicação web de página única, *mobile first*, que oferece um **livro online** onde qualquer pessoa, **sem login e sem senha**, pode escrever nomes de pessoas para quem deseja dedicar aspirações e homenagens.

O objetivo é apoiar a prática budista dos livros, dando a ela um lugar simples, livre e acolhedor, com o máximo de nostalgia de um caderno de pautas, sem que o visual seja o foco.

---

## 2. A prática que inspira o app

Tradição de escrever nomes em um livro todos os dias, principalmente no *puja* da manhã.

### Livro dos Vivos
- Pessoas para quem aspiramos **saúde, longa vida e a realização de suas aspirações**.
- Começa pelos mestres; depois entram os nomes de quem a pessoa lembrar.

### Livro dos Mortos
- Benefício de quem **faleceu nos últimos 49 dias**.
- Também: benfeitores e benfeitoras do darma falecidos, ancestrais e todos os seres que morrem para a nossa sobrevivência.
- Por fim, as pessoas que a pessoa lembrar e quiser adicionar.

---

## 3. Conceito do produto

- **Página única**, responsiva, *mobile first*.
- **Duas abas:** `Vivos` e `Mortos`.
- **Anonimato:** sem cadastro, sem e-mail, sem identificação.
- **Escrita em sequência:** cada pessoa continua de onde a última parou. **Não é possível apagar ou editar o que já foi escrito.**
- **Nomes ilimitados** em quantidade, armazenados no banco para manter o registro por um tempo.
- Páginas com **data no topo**, registrada automaticamente, como um caderno de pautas comum.

---

## 4. Experiência do usuário

### 4.1 Input separado do livro
- Um **campo fixo na parte de baixo** da tela, com o botão **"Escrever"**.
- Ao enviar, o nome aparece na **próxima linha livre** da página atual.
- Motivos: evita conflito entre o teclado do celular e o scroll horizontal, e o botão cria um pequeno momento de ritual (o nome "foi registrado").
- **Desfazer curto (30 a 60 segundos)**, apenas para quem acabou de escrever, para corrigir erro de digitação.

### 4.2 Navegação entre páginas
- Cada página é um **bloco de tela inteira**.
- Seta para a esquerda: a tela desliza para a direita e revela a página anterior (também por gesto de deslizar).
- Quando as linhas da página acabam, a página desliza para a esquerda e revela uma **nova página** em branco.
- O livro **abre sempre na última página**, com o campo pronto para escrever.
- **Sem animações elaboradas.** Só a transição de deslize.
- **12 linhas por página** (letra grande). A altura de cada linha se adapta à tela; nomes longos reduzem a fonte até um mínimo (~13px).
- Setas visíveis (‹ ›) e indicador "Página X de N", além do gesto de deslizar.

### 4.3 Visual e nostalgia
- Papel e pautas em CSS puro (`repeating-linear-gradient`), sombra sutil na dobra, fonte manuscrita legível.
- Nostalgia sem peso: o visual apoia a prática, não a substitui.

### 4.4 Acessibilidade para o público mais velho
- Letra grande e alto contraste.
- Botões grandes; setas visíveis além do gesto.
- Fonte do campo com **16px ou mais** (evita zoom automático no iPhone).
- Fluxo simples, com pouquíssimas decisões por tela.

### 4.5 Denunciar e desfazer (página limpa)
- A página mostra só: abas, data, pauta e nomes. Nenhum botão de denúncia visível.
- **Tocar num nome** abre uma folha na parte de baixo: **Denunciar este nome** / **Cancelar**. Se o nome é de quem acabou de escrever (menos de 60 s), aparece também **Desfazer**.
- Logo após escrever, o rodapé mostra "✓ Nome escrito" com **Desfazer** por 60 s.
- Link discreto **Sobre** no rodapé: finalidade, privacidade e e-mail de remoção.

---

## 5. Modelo de dados (esboço conceitual)

Princípio: **cada nome é uma linha**, em uma tabela de **somente inserção**. Duas pessoas escrevendo ao mesmo tempo apenas entram uma após a outra, sem conflito. As "páginas" são só uma forma de exibir as linhas (ex.: 20 linhas por página).

**Entrada (nome)**
| Campo | Descrição |
|---|---|
| `id` | sequencial |
| `livro` | `vivos` ou `mortos` |
| `pagina` / `linha` | posição fixa, definida na escrita (**nulas** enquanto em quarentena) |
| `texto` | o nome (limite curto) |
| `criado_em` | data/hora (define a data exibida na página) |
| `status` | `visivel`, `quarentena` ou `oculto` |
| `sessao_hash` | identifica a sessão anônima (para denúncias e para o "desfazer") |
| `exibir_ate` | prazo de exibição (relevante no livro dos mortos) |

**Denúncia**
| Campo | Descrição |
|---|---|
| `entrada_id` | entrada denunciada |
| `sessao_hash` | quem denunciou (uma denúncia por sessão) |
| `criado_em` | data/hora |

> Esquema completo em `db/schema.sql`. A **Parte 1 foi executada num projeto Supabase de teste e rodou limpa**, sem nenhuma correção. Os cenários de aceite estão em `db/teste-cenarios.sql` (14 casos com `assert`, dentro de `begin … rollback`, todos passando). A Parte 2 (`pg_cron`) só entra na Tarefa 6.
> Ajustes em relação ao rascunho acima: o `ip_hash` saiu da entrada e vive numa tabela de vida curta só para rate limit (nas denúncias é zerado após 7 dias); a tabela `paginas` guarda a data de abertura de cada página; ocultar uma entrada deixa a linha em branco sem deslocar as páginas seguintes; o botão de emergência (`somente_leitura`) é uma linha de configuração no banco.

---

## 6. Prevenção de abuso (sem login)

Estratégia: **reduzir a superfície de abuso pelo próprio desenho**, para que a moderação manual seja mínima.

### 6.1 O campo só aceita "cara de nome"
- Máximo de ~40 caracteres e ~6 palavras.
- Apenas letras (com acentos), espaço, hífen, apóstrofo e ponto.
- **Sem** números, links, `@`, emojis ou quebra de linha.
- Efeito: propaganda, telefones e frases agressivas simplesmente não cabem.
- Ponto só em abreviaturas ("Ma.", "Dr."), nunca colado em outra letra (barra "site.com"). Só **alfabeto latino** por enquanto.
- Implementação: `src/lib/nomes/validar-nome.ts` + `src/lib/nomes/lista-bloqueio.ts` (42 testes passando). A mesma regra de formato existe como `CHECK` no banco, como rede de segurança.

### 6.2 Sem valor para spammer
- Página com `noindex`.
- Nenhum link clicável, então não há ganho de SEO nem de divulgação.

### 6.3 Filtros e limites
- **Lista de bloqueio em pt-BR** (xingamentos, termos racistas), com normalização de acentos, espaços e trocas de letras por números.
- **Rate limit:** por exemplo, 20 entradas por hora por IP (guardado como hash).
- **Cloudflare Turnstile** (captcha discreto), uma vez por sessão.
- **Honeypot:** campo isca invisível.
- Validação **no cliente e no servidor**. A inserção é feita por função de servidor, nunca direto do navegador.
- Tudo renderizado como **texto puro**, nunca HTML.

### 6.4 Quarentena silenciosa (*shadow*)
- Se o filtro pegar, a pessoa vê o nome na própria tela, mas **ninguém mais vê**.
- O abusador não recebe aviso e não tenta contornar. Sem punição de qualquer tipo.
- Vale **por sessão do navegador, não por IP** (IP é compartilhado e muda).
- Nomes em quarentena **não ocupam linha** no livro: o autor os vê ao fim do livro, na própria tela. Se você aprovar, o nome ganha a próxima linha livre.
- Risco: falso positivo faz um praticante achar que o nome foi registrado. Por isso a lista de bloqueio é **conservadora** (sobrenomes como Pinto, Mata e Bunda ficam de fora) e a revisão semanal serve para aprovar esses casos.

### 6.5 Denúncias
- Botão "denunciar".
- **3 denúncias de sessões diferentes** escondem a entrada automaticamente até revisão.

### 6.6 Botão de emergência
- Variável de ambiente que coloca o livro em **modo somente leitura** em caso de ataque.

### 6.7 Camada opcional de IA
- Um modelo pequeno decide se o texto "parece um nome ou dedicatória respeitosa" antes de publicar.
- **Opcional e não bloqueante:** se a cota acabar, a entrada segue só pelas regras (formato + lista de bloqueio) ou vai para a quarentena.
- Pode começar **sem IA nenhuma** e adicionar depois, se o abuso aparecer.

---

## 7. Moderação (esforço mínimo)

Fluxo em camadas:

1. **Formato restrito** (barra a maior parte).
2. **Lista de bloqueio** (barra o óbvio).
3. **Rate limit + Turnstile** (barra automação).
4. **IA opcional** (só nos casos duvidosos).
5. **Quarentena + denúncias** (revisão humana).

**Esforço estimado:** de 5 a 10 minutos por semana, revisando a quarentena e os denunciados, em um painel simples onde só o administrador pode ocultar entradas.

**Limite conhecido:** nenhum filtro impede alguém de escrever um nome real de má-fé (por exemplo, uma pessoa viva no livro dos mortos). Para isso, vale o **e-mail de remoção**, com a regra de que **pedidos de remoção sempre são atendidos**.

---

## 8. Expiração e retenção

- Separar dois prazos:
  - **Exibição:** por quanto tempo o nome aparece (ex.: **49 dias** no livro dos mortos, alinhado à prática).
  - **Retenção:** por quanto tempo o registro fica no banco, antes da **exclusão definitiva**.
- Executado por job agendado (`pg_cron`, no Supabase).
- Prazos exatos: **a definir** (ver seção 12).

---

## 9. Privacidade e LGPD

> Nota: isto não é aconselhamento jurídico. Vale conferir com um profissional.

- Nomes de pessoas vivas são **dado pessoal de terceiros**.
- Texto curto de **finalidade** (para que os nomes são coletados e por quanto tempo ficam).
- **E-mail de contato** para pedidos de remoção.
- **Não coletar** e-mail, conta ou qualquer identificação de quem escreve.
- **IP apenas como hash**, e só para rate limit.
- O campo curto e restrito evita dados sensíveis (doenças, causa da morte).
- Se usar IA de terceiros na moderação, **mencionar na política de privacidade** que os textos são enviados a esse serviço.

---

## 10. Stack sugerida

| Camada | Escolha | Observação |
|---|---|---|
| Deslizar páginas | CSS `scroll-snap-type: x mandatory` | Nativo, fluido, sem biblioteca |
| Front-end | **SvelteKit 2 + TypeScript** (decidido) | Svelte 5, `adapter-vercel`, CSS puro, como **PWA** (instalável na tela inicial) |
| Hospedagem | Vercel (Hobby) | Uso **não comercial** |
| Banco | Supabase (Postgres) | Inserção via função de servidor |
| Anti-bot | Cloudflare Turnstile | Gratuito |
| Rate limit / expiração | Postgres (tabela + `pg_cron`) | Sem serviço extra |
| Moderação por IA (opcional) | Modelo pequeno (ex.: Gemini no nível gratuito ou Claude Haiku) | Segunda camada, nunca dependência |

---

## 11. Custos e cuidados (meta: tudo gratuito)

O projeto é só texto, com linhas minúsculas (~50 bytes por nome). Os limites gratuitos não devem ser um problema.

**Supabase (grátis)**
- Projetos inativos são **pausados após cerca de uma semana** sem uso. Mitigação: ping agendado.
- **Sem backup automático** no plano grátis. Mitigação: **export semanal** do banco para um local próprio.

**Vercel (Hobby)**
- Restrito a uso **não comercial**. Não colocar doações nem anúncios.

**IA no nível gratuito (ex.: Gemini)**
- Os dados enviados **podem ser usados para melhorar os produtos** do provedor (compartilhamento com terceiro).
- Os limites mudam com frequência: não depender deles.

**Domínio**
- Único custo real: domínio próprio (Registro.br, cerca de R$ 40 por ano). Enquanto isso, o endereço `.vercel.app` funciona.

> Conferir as páginas de preço e limites atuais antes de decidir.

---

## 12. Pontos em aberto

- [x] Nome do projeto: **Livro de Orações Online**.
- [ ] Domínio.
- [x] Linhas por página: **12** (proposta) e limite de 40 caracteres.
- [ ] Prazo de **exibição** no livro dos vivos: assumido **90 dias** (confirmar).
- [ ] Prazo de **retenção** no banco: assumido **90 dias** após o fim da exibição (confirmar).
- [ ] Alfabetos além do latino (ex.: tibetano, chinês) devem ser aceitos?
- [ ] Texto curto de LGPD e e-mail de contato para remoção.
- [ ] Decidir se a IA de moderação entra desde o início ou só depois.
- [ ] Definir a rotina de backup semanal.
- [ ] Fonte manuscrita e paleta do papel.

---

## 13. Andamento

1. [x] Esquema do banco: `db/schema.sql` (quarentena sem ocupar linha; 12 linhas por página), validado num Supabase de teste com `db/teste-cenarios.sql`.
2. [x] Validação e lista de bloqueio: `src/lib/nomes/` (formato, quarentena silenciosa, 42 testes).
3. [x] Esqueleto do layout: protótipo com scroll-snap, dados falsos e sem backend (`prototipo/layout.html`; foi publicado como artefato para teste no celular).
4. [x] Base do projeto: SvelteKit 2 + TypeScript sobre os arquivos existentes, `adapter-vercel`, `.env.example` e comandos no `CLAUDE.md` (Tarefa 0).
5. [x] Camada de servidor: rotas de escrever, ler, denunciar e desfazer; Turnstile; hashes HMAC de sessão e IP.
6. [ ] Painel simples do administrador (`revisao_pendente`, `moderar_entrada`).
7. [ ] Texto de privacidade/LGPD e e-mail de remoção.
8. [ ] Backup semanal e ping anti-pausa do Supabase.
9. [ ] PWA e domínio.

---

## 14. Arquivos do projeto

| Arquivo | O que é |
|---|---|
| `CLAUDE.md` | Instruções permanentes para o agente de código (curto; lido em toda sessão) |
| `docs/projeto.md` | Este documento: decisões e motivos |
| `docs/tarefas.md` | Ordem de trabalho, critérios de aceite e prompt inicial |
| `db/schema.sql` | Esquema do banco (PostgreSQL/Supabase) |
| `db/teste-cenarios.sql` | Cenários de aceite do banco (`assert`, em transação desfeita) |
| `prototipo/layout.html` | Referência exata da experiência (HTML único, dados falsos) |
| `src/lib/nomes/validar-nome.ts` | Validação de formato e decisão visível/quarentena |
| `src/lib/nomes/lista-bloqueio.ts` | Lista inicial de bloqueio (pt-BR) |
| `src/lib/nomes/validar-nome.test.ts` | Testes das regras |
| `src/routes/` | Páginas e rotas de servidor do SvelteKit |
| `.env.example` | Variáveis de ambiente esperadas (sem valores reais) |
