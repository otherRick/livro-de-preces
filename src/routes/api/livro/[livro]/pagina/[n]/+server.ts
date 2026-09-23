// GET /api/livro/vivos/pagina/3?ultima=1
//
// Devolve as linhas da página. Linha oculta ou expirada volta com texto null
// (linha em branco: ninguém se move de lugar). Na última página vão junto os
// nomes em quarentena da própria sessão, que só o autor enxerga.
import type { RequestHandler } from './$types';
import { ehLivro, rpc, type LinhaPagina, type Quarentena } from '$lib/server/banco';
import { erro, json, respostaDeErro } from '$lib/server/http';
import { sessaoDaRequisicao } from '$lib/server/sessao';

export const GET: RequestHandler = async ({ params, url, cookies }) => {
	if (!ehLivro(params.livro)) return erro('Livro desconhecido.', 404);

	const pagina = Number(params.n);
	if (!Number.isInteger(pagina) || pagina < 1) return erro('Página desconhecida.', 404);

	const sessao = sessaoDaRequisicao(cookies);

	try {
		const linhas = await rpc<LinhaPagina[]>('ler_pagina', {
			p_livro: params.livro,
			p_pagina: pagina,
			p_sessao_hash: sessao.hash
		});

		const quarentenas = url.searchParams.has('ultima')
			? await rpc<Quarentena[]>('minhas_quarentenas', {
					p_livro: params.livro,
					p_sessao_hash: sessao.hash
				})
			: [];

		return json({ pagina, linhas, quarentenas });
	} catch (e) {
		return respostaDeErro(e);
	}
};
