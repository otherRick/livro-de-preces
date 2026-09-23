// POST /api/escrever  { livro, texto, sobrenome (isca), turnstile }
//
// Camadas, nesta ordem: honeypot, Turnstile, formato do nome, lista de
// bloqueio, e só então o banco (que ainda faz rate limit e o CHECK).
// A resposta NÃO revela o motivo nem o filtro: um nome em quarentena volta
// como qualquer outro, só sem posição, e o próprio autor o vê no fim do livro.
import type { RequestHandler } from './$types';
import { MENSAGENS_ERRO, validarNome } from '$lib/nomes/validar-nome';
import { ehLivro, rpc, type EntradaBanco } from '$lib/server/banco';
import { erro, json, respostaDeErro } from '$lib/server/http';
import { hashDoIp, sessaoDaRequisicao } from '$lib/server/sessao';
import { turnstileOk } from '$lib/server/turnstile';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const sessao = sessaoDaRequisicao(cookies);
	const ip = getClientAddress();

	let corpo: Record<string, unknown>;
	try {
		corpo = await request.json();
	} catch {
		return erro('Escreva um nome.', 400);
	}

	if (!ehLivro(corpo.livro)) return erro('Escolha o livro dos vivos ou o dos mortos.', 400);

	if (!(await turnstileOk(cookies, sessao.token, corpo.turnstile, ip))) {
		return erro('Não deu para confirmar. Recarregue a página e tente de novo.', 403);
	}

	const validado = validarNome(corpo.texto);
	if (!validado.ok) return erro(MENSAGENS_ERRO[validado.erro], 400);

	// Campo isca: quem preenche é robô. Sem aviso e sem punição — o nome
	// segue o mesmo caminho silencioso da lista de bloqueio.
	const isca = typeof corpo.sobrenome === 'string' && corpo.sobrenome.trim() !== '';
	const destino = isca ? 'quarentena' : validado.destino;
	const motivo = isca ? 'honeypot' : validado.motivo;

	try {
		const entrada = await rpc<EntradaBanco>('registrar_entrada', {
			p_livro: corpo.livro,
			p_texto: validado.texto,
			p_sessao_hash: sessao.hash,
			p_ip_hash: hashDoIp(ip),
			p_status: destino,
			p_motivo: motivo
		});

		return json({
			id: entrada.id,
			texto: entrada.texto,
			pagina: entrada.pagina,
			linha: entrada.linha
		});
	} catch (e) {
		return respostaDeErro(e);
	}
};
