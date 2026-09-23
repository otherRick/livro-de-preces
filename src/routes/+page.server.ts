// A sitekey do Turnstile é pública por definição, mas a Vercel deste projeto
// não aceita nomes com o prefixo PUBLIC_. Ela é exposta deliberadamente apenas
// como dado da página; TURNSTILE_SECRET nunca sai do servidor.
export const load = () => ({
	turnstileSitekey: process.env.TURNSTILE_SITEKEY ?? null
});
