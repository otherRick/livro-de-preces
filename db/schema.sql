-- =====================================================================
-- Livro de Orações Online: esquema do banco (PostgreSQL / Supabase)
-- Como usar: cole no SQL Editor do Supabase e execute a PARTE 1.
--            Depois habilite pg_cron (Database > Extensions) e execute a PARTE 2.
--
-- Princípios
--  * Cada nome é uma linha. Só se insere; ninguém edita.
--  * Cada linha nasce com posição fixa (página + linha). Ocultar uma
--    entrada deixa a linha em branco e NÃO empurra as outras páginas.
--  * Nomes em QUARENTENA não ocupam linha (pagina/linha nulos): só o autor os vê
--    (minhas_quarentenas). Ao serem aprovados, ganham a próxima linha livre.
--  * Nenhum acesso direto do navegador: tudo passa por funções chamadas
--    pelo servidor (Vercel) com a service_role key.
--  * O servidor (não o banco) faz: Turnstile, honeypot, lista de bloqueio
--    e IA opcional. Ele decide 'visivel' ou 'quarentena' e passa ao banco.
--  * sessao_hash e ip_hash = HMAC com segredo do servidor. Nunca IP puro.
--
-- Erros que o servidor deve tratar (mensagens das exceções):
--   somente_leitura | limite_excedido | formato_invalido |
--   status_invalido | nao_permitido | acao_invalida
--
-- ⚠️ Valores ASSUMIDOS (pontos em aberto do documento), ajustáveis na
--    tabela `configuracao`: 12 linhas por página (letra grande no celular), exibição de 90 dias no
--    livro dos vivos, 49 dias no dos mortos, retenção de 90 dias após o
--    fim da exibição. NÃO altere linhas_por_pagina depois de o livro ter
--    entradas, pois as posições já gravadas deixariam de bater.
-- =====================================================================

-- ======================= PARTE 1: ESQUEMA ============================
begin;

create type livro_tipo     as enum ('vivos', 'mortos');
create type entrada_status as enum ('visivel', 'quarentena', 'oculto');

-- ---------- Configuração (uma única linha) ----------
create table configuracao (
  id                     boolean primary key default true check (id),
  somente_leitura        boolean not null default false,  -- botão de emergência
  linhas_por_pagina      int     not null default 12 check (linhas_por_pagina between 5 and 60),
  exibicao_dias_vivos    int     not null default 90,
  exibicao_dias_mortos   int     not null default 49,
  retencao_dias          int     not null default 90,     -- após o fim da exibição
  envios_por_hora        int     not null default 20,     -- por ip_hash
  denuncias_para_ocultar int     not null default 3       -- IPs distintos
);
insert into configuracao default values;

-- ---------- Contador de posições (serializa a escrita por livro) ----------
create table contadores (
  livro           livro_tipo primary key,
  proxima_posicao bigint not null default 0
);
insert into contadores (livro) values ('vivos'), ('mortos');

-- ---------- Páginas (só a data de abertura; sem dado pessoal) ----------
create table paginas (
  livro     livro_tipo  not null,
  numero    int         not null,
  aberta_em timestamptz not null default now(),
  primary key (livro, numero)
);

-- ---------- Entradas (os nomes) ----------
create table entradas (
  id            bigint generated always as identity primary key,
  livro         livro_tipo     not null,
  pagina        int,                      -- nulo enquanto em quarentena (não ocupa linha)
  linha         int            check (linha >= 1),
  texto         text           not null,
  criado_em     timestamptz    not null default now(),
  exibir_ate    timestamptz    not null,
  status        entrada_status not null default 'visivel',
  motivo_status text,                     -- 'filtro', 'denuncias', 'moderacao', 'desfeito_pelo_autor'...
  revisada_em   timestamptz,              -- quando o admin já decidiu; evita re-ocultar
  sessao_hash   text           not null,  -- para "desfazer" e para o autor ver a própria quarentena

  foreign key (livro, pagina) references paginas (livro, numero),
  unique (livro, pagina, linha),
  check (status <> 'visivel'    or (pagina is not null and linha is not null)),
  check (status <> 'quarentena' or  pagina is null),

  -- Formato "cara de nome". A mesma regra roda antes, no servidor (src/lib/nomes/validar-nome.ts),
  -- que é mais estrita (só alfabeto latino). Aqui é a rede de segurança.
  -- Obs.: [[:alpha:]] depende do locale do banco; teste com
  -- 'José', 'Conceição', 'D''Ávila' e 'Nguyễn' (ver testes no final).
  constraint texto_formato check (
        texto = btrim(regexp_replace(texto, '\s+', ' ', 'g'))
    and char_length(texto) between 2 and 40
    and texto ~ '^[[:alpha:]][[:alpha:] .''’-]*$'
    and texto !~ '\.[[:alpha:]]'                                   -- ponto nunca colado numa letra (barra "site.com")
    and char_length(texto) - char_length(replace(texto, '.', '')) <= 3   -- no máx. 3 pontos (abreviaturas)
    and cardinality(string_to_array(texto, ' ')) <= 6
  )
);

create index entradas_exibir_ate_idx on entradas (exibir_ate);
create index entradas_revisao_idx    on entradas (criado_em desc)
  where revisada_em is null and status in ('quarentena', 'oculto');

-- ---------- Denúncias ----------
create table denuncias (
  entrada_id  bigint      not null references entradas (id) on delete cascade,
  sessao_hash text        not null,
  ip_hash     text,                       -- zerado após 7 dias (ver manutenção)
  criado_em   timestamptz not null default now(),
  primary key (entrada_id, sessao_hash)
);

-- ---------- Rate limit (só ip_hash, vida curta) ----------
create table envios_recentes (
  ip_hash   text        not null,
  criado_em timestamptz not null default now()
);
create index envios_recentes_idx on envios_recentes (ip_hash, criado_em);

-- =====================================================================
-- FUNÇÕES (chamadas pelo servidor via RPC com service_role)
-- =====================================================================

-- Reserva a próxima linha do livro. O UPDATE trava o contador, então envios
-- simultâneos entram em fila. Usada por registrar_entrada (nomes visíveis) e
-- por moderar_entrada (ao aprovar um nome vindo da quarentena).
create or replace function alocar_posicao(
  p_livro livro_tipo, p_agora timestamptz,
  out o_pagina int, out o_linha int
)
language plpgsql
as $$
declare
  v_lpp int;
  v_pos bigint;
begin
  select linhas_por_pagina into v_lpp from configuracao;

  update contadores c
     set proxima_posicao = c.proxima_posicao + 1
   where c.livro = p_livro
  returning c.proxima_posicao - 1 into v_pos;

  o_pagina := (v_pos / v_lpp)::int + 1;
  o_linha  := (v_pos % v_lpp)::int + 1;

  -- Primeira linha da página: registra a data de abertura ("data no topo")
  if o_linha = 1 then
    insert into paginas (livro, numero, aberta_em)
    values (p_livro, o_pagina, p_agora)
    on conflict do nothing;
  end if;
end;
$$;


-- Registra um nome. Retorna a linha criada.
-- p_status: 'visivel' ou 'quarentena' (decidido pelo servidor após o filtro).
-- Quarentena NÃO ocupa linha (pagina/linha nulos): só o autor a vê
-- (ver minhas_quarentenas) e, se aprovada, ganha a próxima linha livre.
create or replace function registrar_entrada(
  p_livro       livro_tipo,
  p_texto       text,
  p_sessao_hash text,
  p_ip_hash     text,
  p_status      entrada_status default 'visivel',
  p_motivo      text           default null
) returns entradas
language plpgsql
as $$
declare
  cfg      configuracao%rowtype;
  v_texto  text;
  v_pagina int;
  v_linha  int;
  v_agora  timestamptz := now();
  v_dias   int;
  v_row    entradas;
begin
  select * into cfg from configuracao;

  if cfg.somente_leitura then
    raise exception 'somente_leitura';
  end if;
  if p_status = 'oculto' then
    raise exception 'status_invalido';
  end if;

  -- Rate limit por IP (hash)
  if (select count(*) from envios_recentes e
        where e.ip_hash = p_ip_hash
          and e.criado_em > v_agora - interval '1 hour') >= cfg.envios_por_hora then
    raise exception 'limite_excedido';
  end if;
  insert into envios_recentes (ip_hash) values (p_ip_hash);

  v_texto := btrim(regexp_replace(p_texto, '\s+', ' ', 'g'));
  v_dias  := case p_livro when 'vivos' then cfg.exibicao_dias_vivos
                          else cfg.exibicao_dias_mortos end;

  begin
    if p_status = 'visivel' then
      select a.o_pagina, a.o_linha into v_pagina, v_linha
        from alocar_posicao(p_livro, v_agora) a;
    end if;

    insert into entradas
      (livro, pagina, linha, texto, criado_em, exibir_ate, status, motivo_status, sessao_hash)
    values
      (p_livro, v_pagina, v_linha, v_texto, v_agora,
       v_agora + make_interval(days => v_dias), p_status, p_motivo, p_sessao_hash)
    returning * into v_row;
  exception
    when check_violation or not_null_violation then
      raise exception 'formato_invalido';
  end;

  return v_row;
end;
$$;

-- Desfazer (até 60 s, só pela mesma sessão que escreveu).
-- Se ainda for a última linha do livro, remove de fato e devolve a posição;
-- se alguém já escreveu depois, apenas deixa a linha em branco.
-- Retorna 'removida' ou 'ocultada'.
create or replace function desfazer_entrada(p_id bigint, p_sessao_hash text)
returns text
language plpgsql
as $$
declare
  v_e      entradas;
  v_lpp    int;
  v_pos    bigint;
  v_prox   bigint;
begin
  select * into v_e from entradas
   where id = p_id and sessao_hash = p_sessao_hash;

  if not found
     or v_e.criado_em < now() - interval '60 seconds'
     or v_e.status = 'oculto' then
    raise exception 'nao_permitido';
  end if;

  -- Quarentena não ocupa linha: basta apagar
  if v_e.pagina is null then
    delete from entradas where id = v_e.id;
    return 'removida';
  end if;

  -- Trava o contador para saber, sem corrida, se ainda é a última linha
  select proxima_posicao into v_prox
    from contadores where livro = v_e.livro for update;
  select linhas_por_pagina into v_lpp from configuracao;

  v_pos := (v_e.pagina - 1)::bigint * v_lpp + (v_e.linha - 1);

  if v_pos = v_prox - 1 then
    delete from entradas where id = v_e.id;
    if v_e.linha = 1 then
      delete from paginas where livro = v_e.livro and numero = v_e.pagina;
    end if;
    update contadores set proxima_posicao = proxima_posicao - 1
     where livro = v_e.livro;
    return 'removida';
  else
    update entradas
       set status = 'oculto', motivo_status = 'desfeito_pelo_autor'
     where id = v_e.id;
    return 'ocultada';
  end if;
end;
$$;

-- Lê uma página. Linhas ocultas ou expiradas voltam com texto NULL (linha em branco).
-- Quarentena não aparece aqui (ver minhas_quarentenas).
create or replace function ler_pagina(
  p_livro       livro_tipo,
  p_pagina      int,
  p_sessao_hash text default null
) returns table (
  linha       int,
  entrada_id  bigint,
  texto       text,
  propria     boolean,
  data_pagina date
)
language sql
stable
as $$
  select
    e.linha,
    e.id,
    case when e.exibir_ate > now() and e.status = 'visivel' then e.texto end,
    (e.sessao_hash = p_sessao_hash),
    (pg.aberta_em at time zone 'America/Sao_Paulo')::date
  from entradas e
  join paginas pg on pg.livro = e.livro and pg.numero = e.pagina
  where e.livro = p_livro and e.pagina = p_pagina
  order by e.linha;
$$;

-- Nomes em quarentena da própria sessão (só o autor os vê). O cliente os mostra
-- ao fim do livro, na visão dele, como se estivessem escritos.
create or replace function minhas_quarentenas(p_livro livro_tipo, p_sessao_hash text)
returns table (entrada_id bigint, texto text, criado_em timestamptz)
language sql
stable
as $$
  select e.id, e.texto, e.criado_em
    from entradas e
   where e.livro = p_livro
     and e.sessao_hash = p_sessao_hash
     and e.status = 'quarentena'
     and e.exibir_ate > now()
   order by e.criado_em;
$$;

-- Dados para abrir o livro: última página, primeira com conteúdo visível,
-- tamanho da página e se está em modo somente leitura.
create or replace function resumo_livro(p_livro livro_tipo)
returns table (
  ultima_pagina           int,
  primeira_pagina_visivel int,
  linhas_por_pagina       int,
  somente_leitura         boolean
)
language sql
stable
as $$
  select
    coalesce((select max(pg.numero) from paginas pg where pg.livro = p_livro), 1),
    (select min(e.pagina) from entradas e
      where e.livro = p_livro and e.status = 'visivel' and e.exibir_ate > now()),
    c.linhas_por_pagina,
    c.somente_leitura
  from configuracao c;
$$;

-- Denunciar. Só entradas visíveis. Conta IPs distintos; ao atingir o
-- limite, oculta até o admin revisar (a menos que já tenha sido revisada).
create or replace function denunciar_entrada(
  p_id          bigint,
  p_sessao_hash text,
  p_ip_hash     text
) returns void
language plpgsql
as $$
declare
  v_limite int;
  v_n      int;
begin
  select denuncias_para_ocultar into v_limite from configuracao;

  insert into denuncias (entrada_id, sessao_hash, ip_hash)
  select e.id, p_sessao_hash, p_ip_hash
    from entradas e
   where e.id = p_id and e.status = 'visivel'
  on conflict do nothing;

  select count(distinct d.ip_hash) into v_n
    from denuncias d where d.entrada_id = p_id;

  if v_n >= v_limite then
    update entradas e
       set status = 'oculto', motivo_status = 'denuncias'
     where e.id = p_id and e.status = 'visivel' and e.revisada_em is null;
  end if;
end;
$$;

-- Ação do administrador: 'aprovar' ou 'ocultar'.
-- Aprovar um nome que veio da quarentena dá a ele a próxima linha livre.
create or replace function moderar_entrada(p_id bigint, p_acao text)
returns void
language plpgsql
as $$
declare
  v_e      entradas;
  v_pagina int;
  v_linha  int;
begin
  select * into v_e from entradas where id = p_id;
  if not found then
    raise exception 'nao_permitido';
  end if;

  if p_acao = 'aprovar' then
    if v_e.pagina is null then
      select a.o_pagina, a.o_linha into v_pagina, v_linha
        from alocar_posicao(v_e.livro, now()) a;
    else
      v_pagina := v_e.pagina;
      v_linha  := v_e.linha;
    end if;
    update entradas
       set status = 'visivel', motivo_status = null, revisada_em = now(),
           pagina = v_pagina, linha = v_linha
     where id = p_id;
  elsif p_acao = 'ocultar' then
    update entradas
       set status = 'oculto', motivo_status = 'moderacao', revisada_em = now()
     where id = p_id;
  else
    raise exception 'acao_invalida';
  end if;
end;
$$;

-- Fila de revisão para o painel do administrador
create view revisao_pendente with (security_invoker = true) as
select e.id, e.livro, e.pagina, e.linha, e.texto, e.status, e.motivo_status,
       e.criado_em,
       (select count(distinct d.ip_hash) from denuncias d where d.entrada_id = e.id) as denuncias
  from entradas e
 where e.revisada_em is null
   and e.status in ('quarentena', 'oculto')
   and e.motivo_status is distinct from 'desfeito_pelo_autor'
 order by e.criado_em desc;

-- Manutenção (chamada pelo pg_cron): exclusão definitiva após a retenção
-- e limpeza do ip_hash das denúncias antigas.
create or replace function manutencao_diaria() returns void
language plpgsql
as $$
declare
  v_ret int;
begin
  select retencao_dias into v_ret from configuracao;

  delete from entradas
   where exibir_ate < now() - make_interval(days => v_ret);

  update denuncias set ip_hash = null
   where ip_hash is not null and criado_em < now() - interval '7 days';
end;
$$;

-- =====================================================================
-- PERMISSÕES: ninguém do navegador acessa nada direto
-- =====================================================================
alter table configuracao    enable row level security;
alter table contadores      enable row level security;
alter table paginas         enable row level security;
alter table entradas        enable row level security;
alter table denuncias       enable row level security;
alter table envios_recentes enable row level security;
-- (sem policies = anon/authenticated não leem nem escrevem)

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

grant all     on all tables    in schema public to service_role;
grant execute on all functions in schema public to service_role;

commit;

-- ======================= PARTE 2: AGENDAMENTOS =======================
-- Rode depois de habilitar a extensão pg_cron. Horários em UTC.

-- select cron.schedule('limpa-envios-recentes', '15 * * * *',
--   $$delete from envios_recentes where criado_em < now() - interval '2 hours'$$);
--
-- select cron.schedule('manutencao-diaria', '0 6 * * *',   -- 03:00 em Brasília
--   $$select manutencao_diaria()$$);

-- ======================= OPERAÇÃO (SQL Editor) =======================

-- Botão de emergência (liga/desliga o modo somente leitura):
--   update configuracao set somente_leitura = true;   -- ligar
--   update configuracao set somente_leitura = false;  -- desligar

-- Pedido de remoção (LGPD): apagar de vez, sem esperar a retenção:
--   delete from entradas where id = 123;
--   delete from entradas where lower(texto) = lower('Nome Pedido');

-- Revisar fila:
--   select * from revisao_pendente;
--   select moderar_entrada(123, 'aprovar');   -- ou 'ocultar'

-- ============================ TESTES ================================
-- Rode em um banco de teste. Os quatro primeiros devem passar; o resto deve falhar.
--   select registrar_entrada('vivos', 'José da Conceição', 's1', 'ip1');
--   select registrar_entrada('vivos', 'D''Ávila Nguyễn',   's1', 'ip1');
--   select registrar_entrada('mortos', 'Ma. Helena de Souza-Lima', 's1', 'ip1');
--   select * from ler_pagina('vivos', 1, 's1');
--   select registrar_entrada('vivos', 'compre em www.site.com', 's1', 'ip1'); -- formato_invalido
--   select registrar_entrada('vivos', 'Fulano 123',             's1', 'ip1'); -- formato_invalido
--   select registrar_entrada('vivos', 'a',                      's1', 'ip1'); -- formato_invalido
