const express = require('express'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..'), data = path.join(root, 'data'), app = express();
const safe = p => { const f = path.resolve(data, p); if (!f.startsWith(data + path.sep) || !f.endsWith('.json')) throw Error('caminho inválido'); return f };
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.relative(data, path.join(d, e.name)).split(path.sep).join('/')]);
app.use(express.json({ limit: '2mb' }));
app.use('/monaco', express.static(path.join(__dirname, 'node_modules/monaco-editor/min')));
app.use(express.static(path.join(__dirname, 'public')));
const wrap = f => (q, r) => { try { r.json(f(q)) } catch (e) { r.status(400).json({ erro: e.message }) } };
app.get('/api/tree', wrap(() => walk(data).filter(f => f.endsWith('.json'))));
app.get('/api/file', wrap(q => ({ content: fs.readFileSync(safe(q.query.p), 'utf8') })));
app.put('/api/file', wrap(q => { JSON.parse(q.body.content); fs.writeFileSync(safe(q.body.p), q.body.content); return { ok: 1 } }));
app.post('/api/new', wrap(q => { const f = safe(q.body.p); fs.mkdirSync(path.dirname(f), { recursive: true });
  if (fs.existsSync(f)) throw Error('já existe'); fs.writeFileSync(f, q.body.content);
  const m = /^themes\/([^/]+)\/(classes|bosses)\/([^/]+)\.json$/.exec(q.body.p); // registra no theme.json
  if (m) { const tf = safe(`themes/${m[1]}/theme.json`), t = JSON.parse(fs.readFileSync(tf, 'utf8')); if (!t[m[2]].includes(m[3])) t[m[2]].push(m[3]); fs.writeFileSync(tf, JSON.stringify(t, null, 2)) }
  return { ok: 1 } }));
app.post('/api/publish', wrap(q => { const git = (...a) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8' });
  git('add', '-A'); try { git('commit', '-m', q.body.msg || 'Atualização pela Engine') } catch (e) { }
  return { saida: git('push') || 'Enviado.' } }));
app.listen(5173, () => console.log('Engine: http://localhost:5173'));
