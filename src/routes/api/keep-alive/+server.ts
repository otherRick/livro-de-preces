// Chamada interna da Vercel a cada quatro dias. Além de confirmar que o site
// responde, consulta o banco de verdade para evitar a pausa por inatividade no
// plano gratuito do Supabase. Nunca cria sessão nem expõe dados.
import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from './$types';
import { rpc, type ResumoLivro } from '$lib/server/banco';
import { erro, json } from '$lib/server/http';

function autorizado(recebido: string | null): boolean {
	const segredo = process.env.CRON_SECRET;
	if (!segredo || !recebido) return false;
	const esperado = Buffer.from(`Bearer ${segredo}`);
	const valor = Buffer.from(recebido);
	return esperado.length === valor.length && timingSafeEqual(esperado, valor);
}

export const GET: RequestHandler = async ({ request }) => {
	if (!autorizado(request.headers.get('authorization'))) return erro('Não autorizado.', 401);

	try {
		await rpc<ResumoLivro[]>('resumo_livro', { p_livro: 'vivos' });
		return json({ ativo: true });
	} catch {
		return erro('Não foi possível verificar o livro agora.', 503);
	}
};
