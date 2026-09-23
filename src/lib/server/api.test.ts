// =====================================================================
// Testes de integração das rotas (Tarefa 2).
//
// Rodam contra o Supabase de TESTE e APAGAM as tabelas antes de cada caso.
// Por isso só rodam com PERMITIR_TESTE_DESTRUTIVO=1.
//
//   npm run test:api
//
// Sem .env.local preenchido, os testes são pulados em vez de falhar.
// =====================================================================
import test from 'node:test';
import assert from 'node:assert/strict';

import { POST as escrever } from '../../routes/api/escrever/+server';
import { GET as lerResumo } from '../../routes/api/livro/[livro]/+server';
import { GET as lerPagina } from '../../routes/api/livro/[livro]/pagina/[n]/+server';
import { POST as desfazer } from '../../routes/api/desfazer/+server';
import { POST as denunciar } from '../../routes/api/denunciar/+server';

const pronto =
	!!process.env.SUPABASE_URL &&
	!!process.env.SUPABASE_SERVICE_ROLE_KEY &&
	!!process.env.SEGREDO_SESSAO &&
	!!process.env.SEGREDO_IP &&
	process.env.PERMITIR_TESTE_DESTRUTIVO === '1';

const caso = (nome: string, fn: () => Promise<void>) =>
	test(nome, { skip: pronto ? false : 'defina .env.local e PERMITIR_TESTE_DESTRUTIVO=1' }, fn);

// ---------------------------------------------------------------- utilidades

const cabecalhos = () => {
	const chave = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
	return {
		apikey: chave,
		Authorization: `Bearer ${chave}`,
		'Content-Type': 'application/json',
		Prefer: 'return=minimal'
	};
};

const rest = (caminho: string, init: RequestInit) =>
	fetch(`${process.env.SUPABASE_URL}/rest/v1/${caminho}`, { ...init, headers: cabecalhos() });

/** Zera o banco de teste. Destrutivo de propósito. */
async function limpar() {
	await rest('denuncias?entrada_id=gt.0', { method: 'DELETE' });
	await rest('entradas?id=gt.0', { method: 'DELETE' });
	await rest('paginas?numero=gt.0', { method: 'DELETE' });
	await rest('envios_recentes?criado_em=lt.2999-01-01', { method: 'DELETE' });
	await rest('contadores?livro=in.(vivos,mortos)', {
		method: 'PATCH',
		body: JSON.stringify({ proxima_posicao: 0 })
	});
	await rest('configuracao?id=eq.true', {
		method: 'PATCH',
		body: JSON.stringify({ somente_leitura: false, envios_por_hora: 20 })
	});
}

/** Pote de cookies em memória: uma instância = uma pessoa no navegador dela. */
function potinho(): { get: (n: string) => string | undefined; set: (n: string, v: string) => void } {
	const guardados: Record<string, string> = {};
	return {
		get: (nome) => guardados[nome],
		set: (nome, valor) => {
			guardados[nome] = valor;
		}
	};
}

type Potinho = ReturnType<typeof potinho>;

/** Monta um RequestEvent suficiente para as rotas. */
function evento(opcoes: {
	cookies?: Potinho;
	corpo?: unknown;
	ip?: string;
	params?: Record<string, string>;
	url?: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any {
	const endereco = opcoes.url ?? 'http://localhost/api';
	return {
		request: new Request(endereco, {
			method: opcoes.corpo === undefined ? 'GET' : 'POST',
			headers: { 'content-type': 'application/json' },
			body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo)
		}),
		cookies: opcoes.cookies ?? potinho(),
		getClientAddress: () => opcoes.ip ?? '203.0.113.1',
		params: opcoes.params ?? {},
		url: new URL(endereco)
	};
}

type Escrita = { id: number; texto: string; pagina: number | null; linha: number | null };

async function escreverNome(
	texto: string,
	extras: { cookies?: Potinho; ip?: string; livro?: string; sobrenome?: string } = {}
) {
	const resposta = await escrever(
		evento({
			cookies: extras.cookies,
			ip: extras.ip,
			corpo: { livro: extras.livro ?? 'vivos', texto, sobrenome: extras.sobrenome ?? '' }
		})
	);
	return { status: resposta.status, corpo: (await resposta.json()) as Escrita & { erro?: string } };
}

const lerLinhas = async (pagina: number, cookies?: Potinho) => {
	const resposta = await lerPagina(
		evento({
			cookies,
			params: { livro: 'vivos', n: String(pagina) },
			url: `http://localhost/api/livro/vivos/pagina/${pagina}?ultima=1`
		})
	);
	return (await resposta.json()) as {
		linhas: { linha: number; texto: string | null; propria: boolean }[];
		quarentenas: { entrada_id: number; texto: string }[];
	};
};

// ------------------------------------------------------------------- casos

caso('nome válido ocupa a primeira linha e volta sem dado de sessão', async () => {
	await limpar();
	const { status, corpo } = await escreverNome('José da Conceição');

	assert.equal(status, 200);
	assert.equal(corpo.texto, 'José da Conceição');
	assert.equal(corpo.pagina, 1);
	assert.equal(corpo.linha, 1);
	assert.deepEqual(Object.keys(corpo).sort(), ['id', 'linha', 'pagina', 'texto']);
});

caso('nome fora do formato é recusado com mensagem gentil', async () => {
	await limpar();
	const { status, corpo } = await escreverNome('compre em www.site.com');

	assert.equal(status, 400);
	assert.equal(corpo.erro, 'Escreva só o nome, usando letras.');
	const pagina = await lerLinhas(1);
	assert.equal(pagina.linhas.length, 0, 'recusa não pode gastar linha');
});

caso('termo bloqueado vai para a quarentena silenciosa: só o autor vê', async () => {
	await limpar();
	const autor = potinho();
	const outra = potinho();

	const { status, corpo } = await escreverNome('Fulano Puta', { cookies: autor });
	assert.equal(status, 200, 'a pessoa não pode perceber nada');
	assert.equal(corpo.pagina, null, 'quarentena não ocupa linha');

	await escreverNome('Maria das Graças', { cookies: outra, ip: '203.0.113.2' });

	const visaoDoAutor = await lerLinhas(1, autor);
	assert.equal(visaoDoAutor.quarentenas.length, 1);
	assert.equal(visaoDoAutor.quarentenas[0].texto, 'Fulano Puta');

	const visaoDeOutra = await lerLinhas(1, outra);
	assert.equal(visaoDeOutra.quarentenas.length, 0, 'ninguém mais pode ver');
	assert.deepEqual(
		visaoDeOutra.linhas.map((l) => l.texto),
		['Maria das Graças'],
		'o nome em quarentena não aparece na página de ninguém'
	);
});

caso('campo isca preenchido segue o mesmo caminho silencioso', async () => {
	await limpar();
	const robo = potinho();
	const { status, corpo } = await escreverNome('Nome De Robo', {
		cookies: robo,
		sobrenome: 'preenchido pelo bot'
	});

	assert.equal(status, 200, 'sem aviso e sem punição');
	assert.equal(corpo.pagina, null);
	const pagina = await lerLinhas(1);
	assert.equal(pagina.linhas.length, 0, 'não ocupa linha de ninguém');
});

caso('a página marca os nomes da própria sessão', async () => {
	await limpar();
	const autor = potinho();
	await escreverNome('Ana Beatriz Costa', { cookies: autor });
	await escreverNome('Pedro Henrique', { ip: '203.0.113.3' });

	const pagina = await lerLinhas(1, autor);
	assert.deepEqual(
		pagina.linhas.map((l) => [l.texto, l.propria]),
		[
			['Ana Beatriz Costa', true],
			['Pedro Henrique', false]
		]
	);
});

caso('desfazer remove quando ainda é a última linha', async () => {
	await limpar();
	const autor = potinho();
	const escrita = await escreverNome('Nome Arrependido', { cookies: autor });

	const resposta = await desfazer(evento({ cookies: autor, corpo: { id: escrita.corpo.id } }));
	assert.equal(resposta.status, 200);
	assert.deepEqual(await resposta.json(), { resultado: 'removida' });

	// a linha 1 volta a ficar livre
	const novo = await escreverNome('Helena Souza', { cookies: autor });
	assert.equal(novo.corpo.linha, 1);
});

caso('desfazer tardio deixa a linha em branco, sem mover ninguém', async () => {
	await limpar();
	const autor = potinho();
	const primeiro = await escreverNome('Nome Do Meio', { cookies: autor });
	await escreverNome('Nome Depois', { ip: '203.0.113.4' });

	const resposta = await desfazer(evento({ cookies: autor, corpo: { id: primeiro.corpo.id } }));
	assert.deepEqual(await resposta.json(), { resultado: 'ocultada' });

	const pagina = await lerLinhas(1);
	assert.deepEqual(
		pagina.linhas.map((l) => l.texto),
		[null, 'Nome Depois']
	);
});

caso('desfazer de outra sessão é recusado', async () => {
	await limpar();
	const escrita = await escreverNome('Nome Alheio');

	const resposta = await desfazer(evento({ corpo: { id: escrita.corpo.id } }));
	assert.equal(resposta.status, 409);
});

caso('3 denúncias de IPs distintos escondem o nome', async () => {
	await limpar();
	const escrita = await escreverNome('Nome Denunciado');

	// duas denúncias do mesmo IP contam como uma só
	for (const ip of ['198.51.100.1', '198.51.100.1', '198.51.100.2']) {
		await denunciar(evento({ corpo: { id: escrita.corpo.id }, ip }));
	}
	let pagina = await lerLinhas(1);
	assert.equal(pagina.linhas[0].texto, 'Nome Denunciado', '2 IPs distintos não bastam');

	await denunciar(evento({ corpo: { id: escrita.corpo.id }, ip: '198.51.100.3' }));
	pagina = await lerLinhas(1);
	assert.equal(pagina.linhas[0].texto, null, '3 IPs distintos escondem');
});

caso('rate limit por IP', async () => {
	await limpar();
	await rest('configuracao?id=eq.true', {
		method: 'PATCH',
		body: JSON.stringify({ envios_por_hora: 2 })
	});

	await escreverNome('Limite Um', { ip: '203.0.113.9' });
	await escreverNome('Limite Dois', { ip: '203.0.113.9' });
	const terceiro = await escreverNome('Limite Tres', { ip: '203.0.113.9' });
	assert.equal(terceiro.status, 429);

	const outroIp = await escreverNome('Outro Ip', { ip: '203.0.113.10' });
	assert.equal(outroIp.status, 200);
});

caso('somente_leitura fecha a escrita e mantém a leitura', async () => {
	await limpar();
	await escreverNome('Antes Do Ataque');
	await rest('configuracao?id=eq.true', {
		method: 'PATCH',
		body: JSON.stringify({ somente_leitura: true })
	});

	const tentativa = await escreverNome('Durante O Ataque', { ip: '203.0.113.11' });
	assert.equal(tentativa.status, 503);

	const resposta = await lerResumo(evento({ params: { livro: 'vivos' } }));
	const resumo = (await resposta.json()) as { somente_leitura: boolean; linhas_por_pagina: number };
	assert.equal(resumo.somente_leitura, true);
	assert.equal(resumo.linhas_por_pagina, 12);

	const pagina = await lerLinhas(1);
	assert.equal(pagina.linhas[0].texto, 'Antes Do Ataque');
});

caso('livro inexistente não chega ao banco', async () => {
	const resposta = await lerResumo(evento({ params: { livro: 'nenhum' } }));
	assert.equal(resposta.status, 404);
});
