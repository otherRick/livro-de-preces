// POST /api/desfazer  { id }
//
// Só a sessão que escreveu, e só por 60 s (o banco é quem decide).
// Devolve 'removida' (ainda era a última linha) ou 'ocultada' (alguém já
// escreveu depois, então a linha fica em branco no lugar).
import type { RequestHandler } from './$types';
import { rpc } from '$lib/server/banco';
import { erro, json, respostaDeErro } from '$lib/server/http';
import { sessaoDaRequisicao } from '$lib/server/sessao';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const sessao = sessaoDaRequisicao(cookies);

	let corpo: Record<string, unknown>;
	try {
		corpo = await request.json();
	} catch {
		return erro('Não deu para fazer isso agora.', 400);
	}

	const id = Number(corpo.id);
	if (!Number.isInteger(id) || id < 1) return erro('Não deu para fazer isso agora.', 400);

	try {
		const resultado = await rpc<string>('desfazer_entrada', {
			p_id: id,
			p_sessao_hash: sessao.hash
		});
		return json({ resultado });
	} catch (e) {
		return respostaDeErro(e);
	}
};
