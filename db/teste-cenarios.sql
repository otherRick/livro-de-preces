-- =====================================================================
-- Cenários de aceite da Tarefa 1 (docs/tarefas.md).
--
-- Como rodar: num banco de TESTE que já tenha a PARTE 1 de db/schema.sql
-- aplicada e as tabelas ainda vazias. Cole tudo no SQL Editor do Supabase,
-- ou:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/teste-cenarios.sql
--
-- Tudo roda dentro de uma transação e termina em ROLLBACK: o banco fica
-- como estava. Se um cenário falhar, o erro aparece com a mensagem do
-- assert e a transação é desfeita do mesmo jeito.
--
-- Sucesso = terminar sem erro, com o aviso "TODOS OS CENARIOS PASSARAM".
-- =====================================================================

set plpgsql.check_asserts = on;

begin;

-- Helper: executa um comando e exige que ele falhe com a mensagem esperada.
create or replace function teste_esperar_erro(p_sql text, p_erro text) returns void
language plpgsql as $$
declare
  v_msg text := null;
begin
  begin
    execute p_sql;
  exception when others then
    v_msg := sqlerrm;
  end;
  assert v_msg is not distinct from p_erro,
    format('esperava o erro %L, veio %L', p_erro, coalesce(v_msg, '(sucesso, sem erro)'));
end $$;

do $$
declare
  v_e      entradas;
  v_a      entradas;
  v_b      entradas;
  v_q      entradas;
  v_lpp    int;
  v_pag    int;
  v_res    text;
  v_n      int;
  v_bool   boolean;
  v_texto  text;
  v_data   date;
  i        int;
begin
  select linhas_por_pagina into v_lpp from configuracao;
  assert (select count(*) from entradas) = 0, 'rode num banco de teste vazio';

  -- ------------------------------------------------------------------
  -- 1. Acentos e formatos válidos ocupam a página 1, em sequência
  -- ------------------------------------------------------------------
  select * into v_e from registrar_entrada('vivos', 'José da Conceição', 's1', 'ip1');
  assert v_e.pagina = 1 and v_e.linha = 1 and v_e.status = 'visivel',
    format('José: pagina=%s linha=%s status=%s', v_e.pagina, v_e.linha, v_e.status);

  select * into v_e from registrar_entrada('vivos', 'D''Ávila Nguyễn', 's1', 'ip1');
  assert v_e.linha = 2, format('D''Ávila Nguyễn: linha=%s', v_e.linha);

  select * into v_e from registrar_entrada('vivos', 'Ma. Helena de Souza-Lima', 's1', 'ip1');
  assert v_e.linha = 3, format('Ma. Helena: linha=%s', v_e.linha);

  -- O CHECK do banco também precisa aceitar estes (rede de segurança)
  select * into v_e from registrar_entrada('mortos', 'J. R. R. Tolkien', 's1', 'ip1');
  assert v_e.pagina = 1 and v_e.linha = 1, 'livro dos mortos começa na própria página 1';
  raise notice '1. acentos e formatos válidos: ok';

  -- ------------------------------------------------------------------
  -- 2. Formato inválido é recusado pelo CHECK, como formato_invalido
  -- ------------------------------------------------------------------
  perform teste_esperar_erro(
    $q$select registrar_entrada('vivos', 'compre em www.site.com', 's1', 'ip2')$q$, 'formato_invalido');
  perform teste_esperar_erro(
    $q$select registrar_entrada('vivos', 'Fulano 123', 's1', 'ip2')$q$, 'formato_invalido');
  perform teste_esperar_erro(
    $q$select registrar_entrada('vivos', 'a', 's1', 'ip2')$q$, 'formato_invalido');
  perform teste_esperar_erro(
    $q$select registrar_entrada('vivos', 'Ana Maria Silva Souza Santos Lima Costa', 's1', 'ip2')$q$,
    'formato_invalido');
  perform teste_esperar_erro(
    $q$select registrar_entrada('vivos', 'Fulano.com', 's1', 'ip2')$q$, 'formato_invalido');
  -- Uma recusa não pode consumir uma linha do livro
  assert (select proxima_posicao from contadores where livro = 'vivos') = 3,
    'recusa por formato não pode gastar posição';
  raise notice '2. formato inválido recusado, sem gastar linha: ok';

  -- ------------------------------------------------------------------
  -- 3. Quarentena NÃO ocupa linha e só o autor a vê
  -- ------------------------------------------------------------------
  select * into v_q from registrar_entrada('vivos', 'Fulano Bloqueado', 's1', 'ip3', 'quarentena', 'filtro:teste');
  assert v_q.pagina is null and v_q.linha is null, 'quarentena não pode receber posição';

  select * into v_e from registrar_entrada('vivos', 'Maria das Graças', 's2', 'ip3');
  assert v_e.linha = 4, format('o nome seguinte deve ir para a linha 4, veio %s', v_e.linha);

  select count(*) into v_n from minhas_quarentenas('vivos', 's1');
  assert v_n = 1, format('o autor deve ver a própria quarentena, veio %s', v_n);
  select count(*) into v_n from minhas_quarentenas('vivos', 's2');
  assert v_n = 0, 'outra sessão não pode ver a quarentena alheia';

  select count(*) into v_n from ler_pagina('vivos', 1) where texto = 'Fulano Bloqueado';
  assert v_n = 0, 'quarentena não pode aparecer na página';
  raise notice '3. quarentena silenciosa, sem ocupar linha: ok';

  -- ------------------------------------------------------------------
  -- 4. Aprovar uma quarentena dá a ela a PRÓXIMA linha livre
  -- ------------------------------------------------------------------
  perform moderar_entrada(v_q.id, 'aprovar');
  select * into v_e from entradas where id = v_q.id;
  assert v_e.status = 'visivel' and v_e.pagina = 1 and v_e.linha = 5,
    format('aprovada deveria virar visível na linha 5, veio pagina=%s linha=%s status=%s',
           v_e.pagina, v_e.linha, v_e.status);
  assert v_e.revisada_em is not null, 'aprovar deve marcar revisada_em';
  select count(*) into v_n from minhas_quarentenas('vivos', 's1');
  assert v_n = 0, 'depois de aprovada, sai da lista de quarentena do autor';
  raise notice '4. aprovar dá a próxima linha livre: ok';

  -- ------------------------------------------------------------------
  -- 5. Desfazer: remove se ainda for a última linha
  -- ------------------------------------------------------------------
  select * into v_a from registrar_entrada('vivos', 'Nome Arrependido', 's3', 'ip4');
  assert v_a.linha = 6, format('linha esperada 6, veio %s', v_a.linha);
  select desfazer_entrada(v_a.id, 's3') into v_res;
  assert v_res = 'removida', format('esperava removida, veio %s', v_res);
  assert (select count(*) from entradas where id = v_a.id) = 0, 'a entrada deveria ter sumido';

  -- A linha 6 volta a ficar livre para o próximo nome
  select * into v_e from registrar_entrada('vivos', 'Pedro Henrique', 's4', 'ip4');
  assert v_e.linha = 6, format('a linha 6 deveria estar livre de novo, veio %s', v_e.linha);
  raise notice '5. desfazer remove a última linha e devolve a posição: ok';

  -- ------------------------------------------------------------------
  -- 6. Desfazer depois que alguém escreveu: deixa a linha em branco
  -- ------------------------------------------------------------------
  select * into v_a from registrar_entrada('vivos', 'Nome Do Meio', 's5', 'ip5');
  select * into v_b from registrar_entrada('vivos', 'Nome Depois', 's6', 'ip5');
  select desfazer_entrada(v_a.id, 's5') into v_res;
  assert v_res = 'ocultada', format('esperava ocultada, veio %s', v_res);

  select texto into v_texto from ler_pagina('vivos', 1) where linha = v_a.linha;
  assert v_texto is null, format('a linha desfeita deveria vir em branco, veio %L', v_texto);
  select texto into v_texto from ler_pagina('vivos', 1) where linha = v_b.linha;
  assert v_texto = 'Nome Depois', 'o nome escrito depois não pode se mover';
  assert (select count(*) from revisao_pendente where id = v_a.id) = 0,
    'desfazer do autor não deve entrar na fila de revisão';
  raise notice '6. desfazer tardio deixa a linha em branco, sem empurrar ninguém: ok';

  -- ------------------------------------------------------------------
  -- 7. Desfazer é só de quem escreveu, e só por 60 s
  -- ------------------------------------------------------------------
  select * into v_a from registrar_entrada('vivos', 'Nome Alheio', 's7', 'ip6');
  perform teste_esperar_erro(
    format('select desfazer_entrada(%s, %L)', v_a.id, 's-outra'), 'nao_permitido');
  update entradas set criado_em = now() - interval '2 minutes' where id = v_a.id;
  perform teste_esperar_erro(
    format('select desfazer_entrada(%s, %L)', v_a.id, 's7'), 'nao_permitido');
  raise notice '7. desfazer restrito à sessão e à janela de 60 s: ok';

  -- ------------------------------------------------------------------
  -- 8. Denúncias: 3 IPs distintos ocultam; o mesmo IP repetido não
  -- ------------------------------------------------------------------
  select * into v_a from registrar_entrada('vivos', 'Nome Denunciado', 's8', 'ip7');

  perform denunciar_entrada(v_a.id, 'd1', 'ip-den-1');
  perform denunciar_entrada(v_a.id, 'd2', 'ip-den-1');   -- mesmo IP, outra sessão
  perform denunciar_entrada(v_a.id, 'd3', 'ip-den-2');
  select status into v_res from entradas where id = v_a.id;
  assert v_res = 'visivel', format('2 IPs distintos não podem ocultar, status=%s', v_res);

  perform denunciar_entrada(v_a.id, 'd4', 'ip-den-3');
  select status into v_res from entradas where id = v_a.id;
  assert v_res = 'oculto', format('3 IPs distintos deveriam ocultar, status=%s', v_res);
  select motivo_status into v_res from entradas where id = v_a.id;
  assert v_res = 'denuncias', format('motivo_status=%s', v_res);

  select texto into v_texto from ler_pagina('vivos', 1) where linha = v_a.linha;
  assert v_texto is null, 'nome oculto deve virar linha em branco';
  assert (select count(*) from revisao_pendente where id = v_a.id) = 1,
    'o nome oculto por denúncias deve entrar na fila de revisão';

  -- Ocultar pela moderação marca revisada_em e tira da fila
  perform moderar_entrada(v_a.id, 'ocultar');
  assert (select count(*) from revisao_pendente where id = v_a.id) = 0,
    'depois de revisada, sai da fila';
  perform teste_esperar_erro(
    format('select moderar_entrada(%s, %L)', v_a.id, 'apagar'), 'acao_invalida');
  raise notice '8. 3 denúncias de IPs distintos ocultam: ok';

  -- ------------------------------------------------------------------
  -- 9. Rate limit por IP
  -- ------------------------------------------------------------------
  update configuracao set envios_por_hora = 2;
  perform registrar_entrada('vivos', 'Limite Um', 's9', 'ip-limite');
  perform registrar_entrada('vivos', 'Limite Dois', 's9', 'ip-limite');
  perform teste_esperar_erro(
    $q$select registrar_entrada('vivos', 'Limite Tres', 's9', 'ip-limite')$q$, 'limite_excedido');
  -- Outro IP não é afetado
  perform registrar_entrada('vivos', 'Outro Ip', 's9', 'ip-livre');
  update configuracao set envios_por_hora = 20;
  raise notice '9. rate limit por ip_hash: ok';

  -- ------------------------------------------------------------------
  -- 10. Botão de emergência: somente_leitura bloqueia a escrita
  -- ------------------------------------------------------------------
  update configuracao set somente_leitura = true;
  perform teste_esperar_erro(
    $q$select registrar_entrada('vivos', 'Durante O Ataque', 's10', 'ip8')$q$, 'somente_leitura');
  select somente_leitura into v_bool from resumo_livro('vivos');
  assert v_bool, 'resumo_livro deve avisar o modo somente leitura';
  -- Ler continua funcionando
  assert (select count(*) from ler_pagina('vivos', 1)) > 0, 'leitura não pode parar';
  update configuracao set somente_leitura = false;
  raise notice '10. somente_leitura bloqueia a escrita e mantém a leitura: ok';

  -- ------------------------------------------------------------------
  -- 11. Status 'oculto' não pode entrar pela porta da frente
  -- ------------------------------------------------------------------
  perform teste_esperar_erro(
    $q$select registrar_entrada('vivos', 'Nasce Oculto', 's11', 'ip9', 'oculto')$q$, 'status_invalido');
  raise notice '11. registrar_entrada recusa status oculto: ok';

  -- ------------------------------------------------------------------
  -- 12. A página vira sozinha ao encher
  -- ------------------------------------------------------------------
  i := 0;
  while (select proxima_posicao from contadores where livro = 'vivos') % v_lpp <> 0 loop
    i := i + 1;
    perform registrar_entrada('vivos', 'Nome De Enchimento', 's12', 'ip-enche-' || i);
  end loop;
  -- A página que está para nascer (o livro já passou da primeira nos cenários acima)
  select proxima_posicao / v_lpp + 1 into v_pag from contadores where livro = 'vivos';

  select * into v_e from registrar_entrada('vivos', 'Primeiro Da Nova', 's12', 'ip-enche-novo');
  assert v_e.pagina = v_pag and v_e.linha = 1,
    format('deveria abrir a página %s na linha 1, veio pagina=%s linha=%s',
           v_pag, v_e.pagina, v_e.linha);
  assert (select count(*) from paginas where livro = 'vivos' and numero = v_pag) = 1,
    format('a página %s deveria ter sido registrada', v_pag);

  select ultima_pagina into v_n from resumo_livro('vivos');
  assert v_n = v_pag, format('resumo_livro.ultima_pagina=%s, esperado %s', v_n, v_pag);
  raise notice '12. página nova ao encher a anterior: ok';

  -- ------------------------------------------------------------------
  -- 13. Data no topo da página, no fuso de Brasília
  -- ------------------------------------------------------------------
  select data_pagina into v_data from ler_pagina('vivos', v_pag) limit 1;
  assert v_data = (now() at time zone 'America/Sao_Paulo')::date,
    format('data da página = %s', v_data);
  raise notice '13. data da página em America/Sao_Paulo: ok';

  -- ------------------------------------------------------------------
  -- 14. Expiração: nome vencido some da página sem empurrar as outras linhas
  -- ------------------------------------------------------------------
  select * into v_a from registrar_entrada('mortos', 'Vovó Nazaré', 's13', 'ip10');
  update entradas set exibir_ate = now() - interval '1 day' where id = v_a.id;
  select texto into v_texto from ler_pagina('mortos', 1) where linha = v_a.linha;
  assert v_texto is null, 'nome expirado deve virar linha em branco';

  -- E a retenção apaga de vez
  update entradas set exibir_ate = now() - interval '200 days' where id = v_a.id;
  perform manutencao_diaria();
  assert (select count(*) from entradas where id = v_a.id) = 0,
    'manutencao_diaria deveria ter apagado o registro vencido';
  raise notice '14. exibição e retenção: ok';

  raise notice '=== TODOS OS CENARIOS PASSARAM ===';
end $$;

rollback;
