// POST /api/denunciar  { id }
//
// Uma denúncia por sessão; o banco oculta a entrada ao chegar em 3 IPs
// distintos. A resposta é sempre a mesma, para não revelar o que aconteceu
// com o nome nem se a conta já fechou.
import type { RequestHandler } from './$types';
import { rpc } from '$lib/server/banco';
import { erro, json, respostaDeErro } from '$lib/server/http';
import { hashDoIp, sessaoDaRequisicao } from '$lib/server/sessao';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
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
		await rpc<null>('denunciar_entrada', {
			p_id: id,
			p_sessao_hash: sessao.hash,
			p_ip_hash: hashDoIp(getClientAddress())
		});
		return json({ recebida: true });
	} catch (e) {
		return respostaDeErro(e);
	}
};
