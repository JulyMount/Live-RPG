// Regras do combate (autoridade única: OBS e Painel só exibem o estado)
const r = n => 1 + Math.floor(Math.random() * n);
const pick = a => a[Math.floor(Math.random() * a.length)];
const roll = s => { const m = /(\d+)d(\d+)([+-]\d+)?/.exec(s || '1d4'); let t = +(m[3] || 0); const d = [];
  for (let i = 0; i < +m[1]; i++) { const x = r(+m[2]); d.push(x); t += x } return { t, d } };

module.exports = class Game {
  constructor(th, bc) { this.th = th; this.bc = bc; this.reset() }
  reset() { clearTimeout(this.tm); this.s = { fase: 'idle', cand: [], pl: [], boss: null, ordem: [], i: 0, cur: null, modo: 'IA', log: [], popup: null, pocoes: 3, taunt: null }; this.push() }
  push() { this.bc(this.s) }
  say(t) { this.s.log.unshift(t); this.s.log.length = Math.min(this.s.log.length, 40) }
  pop(t) { this.s.popup = { t, id: Date.now() } }
  abrir() { this.reset(); this.s.fase = 'lobby'; this.push() }
  join(u) { if (this.s.fase === 'lobby' && !this.s.cand.includes(u)) { this.s.cand.push(u); this.push() } }

  start(bossId) {
    const s = this.s, th = this.th;
    if (s.fase !== 'lobby' || !s.cand.length) return;
    const cs = Object.values(th.classes);
    s.pl = [...s.cand].sort(() => Math.random() - .5).slice(0, 4).map(n => { const c = pick(cs);
      return { nome: n, classe: c.nome, hp: c.hp, max: c.hp, def: c.def, atk: c.atk, acoes: c.acoes, especial: pick(c.especiais), bonus: 0, vivo: true } });
    const b = th.bosses[bossId] || Object.values(th.bosses)[0];
    s.boss = JSON.parse(JSON.stringify(b)); s.boss.max = b.hp;
    // Iniciativa: d20 para todos; empatados rolam de novo entre si
    s.pl.forEach(p => p.k = [r(20)]);
    const tied = () => { const m = {}; s.pl.forEach(p => (m[p.k.join()] = m[p.k.join()] || []).push(p)); return Object.values(m).filter(g => g.length > 1) };
    for (let g; (g = tied()).length;) g.flat().forEach(p => p.k.push(r(20)));
    const cmp = (a, b) => { for (let i = 0; ; i++) if (a.k[i] !== b.k[i]) return (b.k[i] ?? 0) - (a.k[i] ?? 0) };
    s.pl.sort(cmp); s.pl.forEach(p => p.ini = p.k[0]);
    s.ordem = [...s.pl.map(p => p.nome), 'boss']; s.i = 0; s.fase = 'batalha';
    this.say(`Ordem: ${s.ordem.join(' > ')}`); this.turn();
  }
  turn() {
    clearTimeout(this.tm); const s = this.s; if (s.fase !== 'batalha') return;
    const who = s.cur = s.ordem[s.i];
    if (who === 'boss') { this.push(); if (s.modo === 'IA') this.tm = setTimeout(() => this.boss(), 3000); return }
    if (!s.pl.find(p => p.nome === who).vivo) return this.next();
    this.push(); this.tm = setTimeout(() => this.act(who, 1), 30000); // timeout: executa !1
  }
  next() {
    const s = this.s;
    if (s.boss.hp <= 0) { s.fase = 'fim'; this.pop('VITÓRIA!') }
    else if (!s.pl.some(p => p.vivo)) { s.fase = 'fim'; this.pop('DERROTA...') }
    else { s.i = (s.i + 1) % s.ordem.length; return this.turn() }
    this.push();
  }
  phase() {
    const b = this.s.boss; if (b.fase2 && !b.f2 && b.hp <= b.max * b.fase2.hpPct) {
      b.f2 = true; b.def += b.fase2.def; b.mod = b.fase2.dano; this.say('FASE 2: Sobrecarga!'); this.pop('SOBRECARGA!') } }

  act(u, n) {
    const s = this.s; if (s.fase !== 'batalha' || s.cur !== u) return;
    const p = s.pl.find(x => x.nome === u), a = n === 4 ? p.especial : p.acoes[n - 1]; if (!a) return;
    clearTimeout(this.tm);
    if (a.tipo === 'ataque') {
      const d = r(20), t = d + p.atk;
      if (t >= s.boss.def) { const x = roll(a.dado); s.boss.hp = Math.max(0, s.boss.hp - x.t);
        this.say(`${u} usou ${a.nome}: d20 ${d}+${p.atk}=${t} ≥ DEF ${s.boss.def}. Dano ${x.t} [${x.d}]`); this.pop(`ACERTOU! -${x.t} HP`); this.phase() }
      else { this.say(`${u} usou ${a.nome}: ${t} < DEF ${s.boss.def}. MISS`); this.pop(`MISS! (DEF ${s.boss.def})`) }
    } else if (a.tipo === 'cura') {
      const x = roll(a.dado), al = s.pl.filter(q => q.vivo).sort((m, k) => m.hp / m.max - k.hp / k.max)[0];
      al.hp = Math.min(al.max, al.hp + x.t); this.say(`${u} usou ${a.nome}: ${al.nome} +${x.t} HP`); this.pop(`CURA +${x.t} HP`);
    } else if (a.tipo === 'taunt') { s.taunt = u; this.say(`${u} provocou o Boss`); this.pop('PROVOCADO!') }
    else if (a.tipo === 'buff') { p.bonus += a.valor || 2; this.say(`${u} usou ${a.nome}: +${a.valor || 2} DEF`); this.pop(`+${a.valor || 2} DEF`) }
    else { this.say(`${u} usou ${a.nome} (efeito ainda não implementado)`) }
    this.next();
  }
  pocao(u) {
    const s = this.s; if (s.fase !== 'batalha' || s.cur !== u || s.pocoes < 1) return;
    const p = s.pl.find(x => x.nome === u); clearTimeout(this.tm); s.pocoes--; p.hp = Math.min(p.max, p.hp + 15);
    this.say(`${u} bebeu uma poção (+15 HP)`); this.pop('POÇÃO +15 HP'); this.next();
  }
  setModo(m) { const s = this.s; s.modo = m; if (m === 'IA' && s.cur === 'boss' && s.fase === 'batalha') this.tm = setTimeout(() => this.boss(), 1500); this.push() }
  boss(i) {
    const s = this.s, b = s.boss; if (s.fase !== 'batalha' || s.cur !== 'boss') return; clearTimeout(this.tm);
    let ac;
    if (i === 'mestre') ac = b.acaoMestre;
    else if (i !== undefined) ac = b.acoes[i];
    else { let x = Math.random() * b.acoes.reduce((t, o) => t + o.peso, 0); ac = b.acoes.find(o => (x -= o.peso) < 0) || b.acoes[0] }
    const vivos = s.pl.filter(p => p.vivo);
    if (ac.dado) {
      const alvos = ac.tipo === 'aoe' ? vivos : [vivos.find(p => p.nome === s.taunt) || pick(vivos)];
      alvos.forEach(p => { const d = r(20), t = d + (b.atk || 4), def = p.def + p.bonus;
        if (t >= def) { const x = roll(ac.dado).t + (b.mod || 0); p.hp = Math.max(0, p.hp - x); if (!p.hp) p.vivo = false;
          this.say(`Boss usou ${ac.nome} em ${p.nome}: ${t} ≥ DEF ${def}. Dano ${x}`) }
        else this.say(`Boss usou ${ac.nome} em ${p.nome}: ${t} < DEF ${def}. MISS`) });
    } else { b.def += 2; this.say(`Boss usou ${ac.nome}: +2 DEF`) }
    this.pop(ac.nome); s.taunt = null; s.pl.forEach(p => p.bonus = 0); this.next();
  }
};
