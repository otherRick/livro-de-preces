// =====================================================================
// Sessão anônima: um token aleatório num cookie httpOnly.
//
// No banco só entra o HMAC do token (segredo do servidor), nunca o token.
// O IP também só existe como HMAC, e só para rate limit e denúncias.
// Sem conta, sem e-mail, sem nada que identifique a pessoa.
// =====================================================================
import { createHmac, randomBytes } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';

const COOKIE_SESSAO = 'sessao';
const UM_ANO = 60 * 60 * 24 * 365;

function segredo(nome: 'SEGREDO_SESSAO' | 'SEGREDO_IP'): string {
	const valor = process.env[nome];
	if (!valor) throw new Error(`variável de ambiente ausente: ${nome}`);
	return valor;
}

function hmac(nomeSegredo: 'SEGREDO_SESSAO' | 'SEGREDO_IP', valor: string): string {
	return createHmac('sha256', segredo(nomeSegredo)).update(valor).digest('base64url');
}

export type Sessao = { token: string; hash: string };

/** Lê a sessão do cookie; se não houver, cria uma e já manda o cookie. */
export function sessaoDaRequisicao(cookies: Cookies): Sessao {
	let token = cookies.get(COOKIE_SESSAO);

	if (!token) {
		token = randomBytes(32).toString('base64url');
		cookies.set(COOKIE_SESSAO, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			maxAge: UM_ANO
		});
	}

	return { token, hash: hmac('SEGREDO_SESSAO', token) };
}

export const hashDoIp = (ip: string): string => hmac('SEGREDO_IP', ip);

/** Selo que prova que esta sessão já passou pelo Turnstile (ver turnstile.ts). */
export const seloDaSessao = (token: string, proposito: string): string =>
	hmac('SEGREDO_SESSAO', `${proposito}:${token}`);
