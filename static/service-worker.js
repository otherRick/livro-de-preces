// O livro precisa de dados atuais; por isso o service worker não guarda
// páginas nem respostas da API. Ele só habilita a instalação como PWA.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
