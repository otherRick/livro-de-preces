# Operação no Supabase

## Agendamentos internos

No painel do projeto Supabase, abra **Integrations → Cron**, habilite `pg_cron` e crie os dois jobs abaixo. Eles são internos ao banco: não exigem variável na Vercel nem chamada externa.

| Nome | Agenda (UTC) | Finalidade |
|---|---|---|
| `limpa-envios-recentes` | `15 * * * *` | Apaga hashes temporários usados pelo limite de envio após duas horas. |
| `manutencao-diaria` | `0 6 * * *` | Às 03:00 em Brasília, apaga nomes após a retenção e hashes de IP de denúncias após sete dias. |

Também é possível criar ambos pelo **SQL Editor**:

```sql
select cron.schedule(
  'limpa-envios-recentes',
  '15 * * * *',
  $$delete from envios_recentes where criado_em < now() - interval '2 hours'$$
);

select cron.schedule(
  'manutencao-diaria',
  '0 6 * * *',
  $$select manutencao_diaria()$$
);
```

Após executar, confirme que os dois aparecem em **Cron → Jobs**. Se precisar refazer um job, exclua-o no painel antes de executar novamente; não crie duplicados.

## Keep-alive da Vercel

O arquivo `vercel.json` agenda `GET /api/keep-alive` em `0 12 */4 * *` (UTC): dias 1, 5, 9, 13, 17, 21, 25 e 29 de cada mês, às 09:00 em Brasília. A rota faz uma consulta autenticada ao banco e não coleta nem devolve nomes.

Na Vercel, crie `CRON_SECRET` nos ambientes de produção, preview e desenvolvimento com um valor aleatório de pelo menos 16 caracteres. Após salvar a variável, faça um novo deploy. A Vercel envia esse valor automaticamente no cabeçalho de autorização da chamada agendada.

## Decisões de operação

- Não há backup. Os nomes são transitórios e a perda deles é aceitável para este projeto.
