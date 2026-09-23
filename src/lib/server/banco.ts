// =====================================================================
// Única porta de entrada para o banco.
//
// O navegador NUNCA fala com o Postgres. Todas as rotas chamam as funções
// SQL (db/schema.sql) por RPC do PostgREST, usando a service_role key, que
// só existe em variável de ambiente do servidor.
//
// Este arquivo vive em src/lib/server/: o SvelteKit recusa importá-lo a
// partir de código de cliente, então a chave não tem como vazar no bundle.
// =====================================================================

/** Erro vindo do banco. A `mensagem` é a do `raise exception` do schema. */
export class ErroBanco extends Error {}

function ambiente(nome: string): string {
	const valor = process.env[nome];
	if (!valor) throw new Error(`variável de ambiente ausente: ${nome}`);
	return valor;
}

/** Chama uma função SQL. Lança ErroBanco com a mensagem crua do Postgres. */
export async function rpc<T>(funcao: string, argumentos: Record<string, unknown>): Promise<T> {
	const chave = ambiente('SUPABASE_SERVICE_ROLE_KEY');

	const resposta = await fetch(`${ambiente('SUPABASE_URL')}/rest/v1/rpc/${funcao}`, {
		method: 'POST',
		headers: {
			apikey: chave,
			Authorization: `Bearer ${chave}`,
			'Content-Type': 'application/json',
			Accept: 'application/json'
		},
		body: JSON.stringify(argumentos)
	});

	const corpo = await resposta.text();

	if (!resposta.ok) {
		let mensagem = `http_${resposta.status}`;
		try {
			mensagem = JSON.parse(corpo).message ?? mensagem;
		} catch {
			// corpo não-JSON: fica o http_NNN
		}
		throw new ErroBanco(mensagem);
	}

	return corpo ? (JSON.parse(corpo) as T) : (null as T);
}

export type Livro = 'vivos' | 'mortos';

export const ehLivro = (v: unknown): v is Livro => v === 'vivos' || v === 'mortos';

/** Linha de `entradas` como o banco devolve. Nunca vai inteira para o navegador. */
export type EntradaBanco = {
	id: number;
	livro: Livro;
	pagina: number | null;
	linha: number | null;
	texto: string;
	criado_em: string;
	exibir_ate: string;
	status: 'visivel' | 'quarentena' | 'oculto';
	motivo_status: string | null;
	revisada_em: string | null;
	sessao_hash: string;
};

export type LinhaPagina = {
	linha: number;
	entrada_id: number;
	texto: string | null;
	propria: boolean;
	data_pagina: string;
};

export type ResumoLivro = {
	ultima_pagina: number;
	primeira_pagina_visivel: number | null;
	linhas_por_pagina: number;
	somente_leitura: boolean;
};

export type Quarentena = { entrada_id: number; texto: string; criado_em: string };
