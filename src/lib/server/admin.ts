import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';

const COOKIE_ADMIN = 'livro_admin';
const UMA_SEMANA = 60 * 60 * 24 * 7;

function configuracao() {
	const senha = process.env.ADMIN_SENHA;
	const segredo = process.env.SEGREDO_SESSAO;
	if (!senha || !segredo) throw new Error('admin_nao_configurado');
	return { senha, segredo };
}

function assinatura() {
	const { senha, segredo } = configuracao();
	return createHmac('sha256', segredo).update(`admin:${senha}`).digest('base64url');
}

/** Comparação de senha sem diferença observável pelo tamanho ou conteúdo. */
export function senhaAdminConfere(tentativa: string): boolean {
	const { senha } = configuracao();
	const recebida = Buffer.from(tentativa);
	const esperada = Buffer.from(senha);
	return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
}

export function adminDaRequisicao(cookies: Cookies): boolean {
	const valor = cookies.get(COOKIE_ADMIN);
	if (!valor) return false;
	try {
		const recebido = Buffer.from(valor);
		const esperado = Buffer.from(assinatura());
		return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
	} catch {
		return false;
	}
}

export function iniciarAdmin(cookies: Cookies) {
	cookies.set(COOKIE_ADMIN, assinatura(), {
		path: '/admin',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: UMA_SEMANA
	});
}

export function encerrarAdmin(cookies: Cookies) {
	cookies.delete(COOKIE_ADMIN, { path: '/admin' });
}
