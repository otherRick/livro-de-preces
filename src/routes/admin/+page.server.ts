import { fail, redirect } from '@sveltejs/kit';
import { adminDaRequisicao, encerrarAdmin, iniciarAdmin, senhaAdminConfere } from '$lib/server/admin';
import { consultar, rpc } from '$lib/server/banco';

type Pendente = {
	id: number;
	livro: 'vivos' | 'mortos';
	texto: string;
	status: 'quarentena' | 'oculto';
	motivo_status: string | null;
	criado_em: string;
	denuncias: number;
};

async function dadosDoPainel() {
	const [pendentes, configuracao] = await Promise.all([
		consultar<Pendente[]>('revisao_pendente?select=id,livro,texto,status,motivo_status,criado_em,denuncias'),
		consultar<Array<{ somente_leitura: boolean }>>('configuracao?select=somente_leitura&id=eq.true')
	]);
	return { pendentes, somenteLeitura: configuracao[0]?.somente_leitura ?? false };
}

function exigirAdmin(cookies: Parameters<typeof adminDaRequisicao>[0]) {
	if (!adminDaRequisicao(cookies)) redirect(303, '/admin');
}

export const load = async ({ cookies }: { cookies: Parameters<typeof adminDaRequisicao>[0] }) => {
	if (!adminDaRequisicao(cookies)) return { autenticado: false };
	return { autenticado: true, ...(await dadosDoPainel()) };
};

export const actions = {
	entrar: async ({ request, cookies }: { request: Request; cookies: Parameters<typeof adminDaRequisicao>[0] }) => {
		const dados = await request.formData();
		const senha = dados.get('senha');
		if (typeof senha !== 'string' || !senhaAdminConfere(senha)) return fail(401, { erroLogin: 'Senha incorreta.' });
		iniciarAdmin(cookies);
		redirect(303, '/admin');
	},
	sair: async ({ cookies }: { cookies: Parameters<typeof adminDaRequisicao>[0] }) => {
		encerrarAdmin(cookies);
		redirect(303, '/admin');
	},
	moderar: async ({ request, cookies }: { request: Request; cookies: Parameters<typeof adminDaRequisicao>[0] }) => {
		exigirAdmin(cookies);
		const dados = await request.formData();
		const id = Number(dados.get('id'));
		const acao = dados.get('acao');
		if (!Number.isSafeInteger(id) || id < 1 || (acao !== 'aprovar' && acao !== 'ocultar')) return fail(400, { erro: 'Pedido inválido.' });
		await rpc<void>('moderar_entrada', { p_id: id, p_acao: acao });
		return { sucesso: acao === 'aprovar' ? 'Nome aprovado.' : 'Nome ocultado.' };
	},
	alternarLeitura: async ({ request, cookies }: { request: Request; cookies: Parameters<typeof adminDaRequisicao>[0] }) => {
		exigirAdmin(cookies);
		const dados = await request.formData();
		const somenteLeitura = dados.get('somente_leitura') === 'true';
		await consultar<null>('configuracao?id=eq.true', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
			body: JSON.stringify({ somente_leitura: somenteLeitura })
		});
		return { sucesso: somenteLeitura ? 'Livro fechado para novas escritas.' : 'Livro aberto para novas escritas.' };
	}
};
