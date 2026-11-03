const express = require('express'), http = require('http'), { WebSocketServer } = require('ws'), fs = require('fs'), path = require('path'), Game = require('./game');
const root = path.join(__dirname, '..'), cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json')));
// Dados: GitHub (githubRaw preenchido no config.json) ou pasta local data/
const get = async p => cfg.githubRaw ? await (await fetch(`${cfg.githubRaw}/${p}`)).json() : JSON.parse(fs.readFileSync(path.join(root, 'data', p), 'utf8'));
(async () => {
  const base = `themes/${cfg.tema}`, t = await get(`${base}/theme.json`), th = { nome: t.nome, classes: {}, bosses: {} };
  for (const c of t.classes) th.classes[c] = await get(`${base}/classes/${c}.json`);
  for (const b of t.bosses) th.bosses[b] = await get(`${base}/bosses/${b}.json`);
  const app = express(), srv = http.createServer(app), wss = new WebSocketServer({ server: srv });
  const pack = s => JSON.stringify({ state: s, bosses: Object.keys(th.bosses), tema: th.nome });
  const g = new Game(th, s => wss.clients.forEach(c => c.readyState === 1 && c.send(pack(s))));
  const chat = (u, txt) => { const m = txt.trim().toLowerCase();
    if (m === '!participar') g.join(u); else if (/^![1-3]$/.test(m)) g.act(u, +m[1]);
    else if (m === '!4' || m === '!especial') g.act(u, 4); else if (m === '!pocao') g.pocao(u) };
  app.use(express.json()); app.use('/obs', express.static(path.join(root, 'OBS'))); app.use(express.static(path.join(__dirname, 'public')));
  app.post('/chat', (q, r) => { chat(q.body.user, q.body.text); r.sendStatus(200) }); // ponte futura do chat do YouTube
  wss.on('connection', ws => { ws.send(pack(g.s)); ws.on('message', m => { const c = JSON.parse(m);
    ({ abrir: () => g.abrir(), start: () => g.start(c.boss), reset: () => g.reset(), modo: () => g.setModo(c.modo),
       boss: () => g.s.modo === 'Controle' && g.boss(c.i), chat: () => chat(c.user, c.text) })[c.cmd]?.() }) });
  srv.listen(3000, () => console.log('Painel: http://localhost:3000   |   OBS (fonte Navegador): http://localhost:3000/obs/'));
})();
