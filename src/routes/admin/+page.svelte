<script lang="ts">
	export let data: {
		autenticado: boolean;
		pendentes?: Array<{ id: number; livro: 'vivos' | 'mortos'; texto: string; status: string; motivo_status: string | null; criado_em: string; denuncias: number }>;
		somenteLeitura?: boolean;
	};
	export let form: { erroLogin?: string; erro?: string; sucesso?: string } | null;

	const dataHora = (valor: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(valor));
</script>

<svelte:head><title>Administração — Livro de Orações</title><meta name="robots" content="noindex,nofollow" /></svelte:head>

<main>
	{#if !data.autenticado}
		<section class="acesso" aria-labelledby="titulo">
			<h1 id="titulo">Administração</h1>
			<p>Acesso reservado ao dono do livro.</p>
			<form method="POST" action="?/entrar">
				<label for="senha">Senha</label>
				<input id="senha" name="senha" type="password" autocomplete="current-password" required />
				{#if form?.erroLogin}<p class="erro" role="alert">{form.erroLogin}</p>{/if}
				<button>Entrar</button>
			</form>
		</section>
	{:else}
		<header><div><h1>Administração</h1><p>Revisão de nomes e controle do livro.</p></div><form method="POST" action="?/sair"><button class="secundario">Sair</button></form></header>
		{#if form?.sucesso}<p class="aviso" role="status">{form.sucesso}</p>{/if}
		{#if form?.erro}<p class="erro" role="alert">{form.erro}</p>{/if}

		<section class="controle" aria-labelledby="controle-titulo">
			<div><h2 id="controle-titulo">Escrita no livro</h2><p>{data.somenteLeitura ? 'Pausada: ninguém pode escrever novos nomes.' : 'Aberta: novas escritas estão liberadas.'}</p></div>
			<form method="POST" action="?/alternarLeitura"><input type="hidden" name="somente_leitura" value={data.somenteLeitura ? 'false' : 'true'} /><button class:perigo={data.somenteLeitura}>{data.somenteLeitura ? 'Abrir livro' : 'Pausar escrita'}</button></form>
		</section>

		<section aria-labelledby="fila-titulo">
			<h2 id="fila-titulo">Para revisar ({data.pendentes?.length ?? 0})</h2>
			{#if data.pendentes?.length}
				<ul class="fila">
					{#each data.pendentes as entrada}
						<li><div class="nome">{entrada.texto}</div><p><b>{entrada.livro === 'vivos' ? 'Vivos' : 'Mortos'}</b> · {entrada.status}{#if entrada.motivo_status} · {entrada.motivo_status}{/if}<br />{dataHora(entrada.criado_em)} · {entrada.denuncias} denúncia{entrada.denuncias === 1 ? '' : 's'}</p><div class="acoes"><form method="POST" action="?/moderar"><input type="hidden" name="id" value={entrada.id} /><input type="hidden" name="acao" value="aprovar" /><button>Aprovar</button></form><form method="POST" action="?/moderar"><input type="hidden" name="id" value={entrada.id} /><input type="hidden" name="acao" value="ocultar" /><button class="secundario">Ocultar</button></form></div></li>
					{/each}
				</ul>
			{:else}<p class="vazio">Não há nomes aguardando revisão.</p>{/if}
		</section>
	{/if}
</main>

<style>
	:global(*){box-sizing:border-box}:global(body){margin:0;background:#211d17;color:#eadfc8;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}main{width:min(760px,100%);margin:auto;padding:28px 18px 48px}h1{margin:0;font-size:30px}h2{font-size:22px}p{color:#c4b9a4;line-height:1.45}.acesso{max-width:420px;margin:12vh auto;background:#2d271f;border:1px solid #605442;border-radius:16px;padding:26px}.acesso form{display:grid;gap:10px;margin-top:24px}label{font-weight:700}input{min-height:48px;border:2px solid #8c806c;border-radius:10px;padding:8px 12px;background:#fbf5e6;color:#243654;font:18px system-ui}button{min-height:46px;padding:8px 16px;border:0;border-radius:10px;background:#e3aa5a;color:#2a1c10;font:700 16px system-ui;cursor:pointer}button:focus-visible{outline:3px solid #fff;outline-offset:3px}header,.controle,.acoes{display:flex;align-items:center;justify-content:space-between;gap:14px}header{padding-bottom:22px;border-bottom:1px solid #605442}.secundario{background:transparent;color:#eadfc8;border:2px solid #8c806c}.controle{margin:22px 0;padding:18px;background:#2d271f;border-radius:14px}.controle h2{margin:0}.controle p{margin:5px 0 0}.perigo{background:#b96855;color:#fff}.aviso,.erro,.vazio{padding:12px 14px;border-radius:10px}.aviso{background:#305d43;color:#e7f7e9}.erro{background:#6e3932;color:#ffe6e1}.fila{padding:0;margin:12px 0;list-style:none;display:grid;gap:12px}.fila li{padding:18px;background:#fbf5e6;color:#243654;border-radius:12px}.nome{font:26px/1.1 'Segoe Print','Comic Sans MS',cursive}.fila p{margin:8px 0 14px;color:#625e54}.acoes{justify-content:flex-start}.acoes form{margin:0}@media(max-width:480px){main{padding:20px 12px}.controle,header{align-items:flex-start;flex-direction:column}.controle form,.controle form button{width:100%}.acoes{width:100%}.acoes form,.acoes button{flex:1;width:100%}}
</style>
