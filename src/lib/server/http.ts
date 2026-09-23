// =====================================================================
// Respostas HTTP e tradução dos erros do banco.
//
// Tom: acolhedor e calmo. A resposta nunca explica qual filtro pegou o
// nome, nem diz que existe quarentena. Ninguém é punido nem avisado.
// =====================================================================
import { ErroBanco } from './banco';

export function json(dados: unknown, status = 200): Response {
	return new Response(JSON.stringify(dados), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
	});
}

export const erro = (mensagem: string, status: number): Response => json({ erro: mensagem }, status);

/** Mensagens das exceções de db/schema.sql. */
const ERROS_DO_BANCO: Record<string, { status: number; mensagem: string }> = {
	somente_leitura: {
		status: 503,
		mensagem: 'O livro está fechado por um momento. Volte daqui a pouco.'
	},
	limite_excedido: {
		status: 429,
		mensagem: 'Muitos nomes em pouco tempo. Descanse um pouco e continue depois.'
	},
	formato_invalido: { status: 400, mensagem: 'Escreva só o nome, usando letras.' },
	nao_permitido: { status: 409, mensagem: 'Não deu para fazer isso agora.' },
	status_invalido: { status: 400, mensagem: 'Não deu para escrever agora.' },
	acao_invalida: { status: 400, mensagem: 'Não deu para fazer isso agora.' }
};

/** Traduz a exceção para uma resposta. Erro inesperado vira 500 sem detalhe. */
export function respostaDeErro(e: unknown): Response {
	if (e instanceof ErroBanco) {
		const conhecido = ERROS_DO_BANCO[e.message];
		if (conhecido) return erro(conhecido.mensagem, conhecido.status);
	}
	console.error('erro inesperado:', e);
	return erro('Algo não funcionou aqui. Tente de novo em instantes.', 500);
}
