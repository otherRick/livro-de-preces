// =====================================================================
// Cloudflare Turnstile: uma vez por sessão.
//
// Depois de passar, a sessão ganha um cookie com um selo HMAC do próprio
// token. Assim não é preciso guardar nada no banco e o selo não pode ser
// forjado nem reaproveitado por outra sessão.
//
// Sem TURNSTILE_SECRET (desenvolvimento), a verificação é dispensada.
// =====================================================================
import type { Cookies } from '@sveltejs/kit';
import { seloDaSessao } from './sessao';

const COOKIE_TURNSTILE = 'turnstile';
const UM_ANO = 60 * 60 * 24 * 365;
const URL_VERIFICACAO = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function turnstileOk(
	cookies: Cookies,
	tokenSessao: string,
	respostaDoWidget: unknown,
	ip: string
): Promise<boolean> {
	const segredo = process.env.TURNSTILE_SECRET;
	if (!segredo) return true;

	const selo = seloDaSessao(tokenSessao, COOKIE_TURNSTILE);
	if (cookies.get(COOKIE_TURNSTILE) === selo) return true;

	if (typeof respostaDoWidget !== 'string' || !respostaDoWidget) return false;

	const corpo = new URLSearchParams({ secret: segredo, response: respostaDoWidget, remoteip: ip });
	const resposta = await fetch(URL_VERIFICACAO, { method: 'POST', body: corpo });
	const dados = (await resposta.json()) as { success?: boolean };
	if (!dados.success) return false;

	cookies.set(COOKIE_TURNSTILE, selo, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: UM_ANO
	});
	return true;
}
