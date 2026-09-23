// GET /api/livro/vivos  -> como abrir o livro (última página, tamanho, estado)
import type { RequestHandler } from './$types';
import { ehLivro, rpc, type ResumoLivro } from '$lib/server/banco';
import { erro, json, respostaDeErro } from '$lib/server/http';
import { sessaoDaRequisicao } from '$lib/server/sessao';

export const GET: RequestHandler = async ({ params, cookies }) => {
	if (!ehLivro(params.livro)) return erro('Livro desconhecido.', 404);

	// Garante o cookie de sessão já na abertura, para o "desfazer" e para o
	// autor enxergar os próprios nomes em quarentena.
	sessaoDaRequisicao(cookies);

	try {
		const [resumo] = await rpc<ResumoLivro[]>('resumo_livro', { p_livro: params.livro });
		return json(resumo);
	} catch (e) {
		return respostaDeErro(e);
	}
};
