'use strict';

const MEALS = [
  ['cafe', 'Café da manhã'],
  ['almoco', 'Almoço'],
  ['jantar', 'Jantar'],
  ['lanche', 'Lanches'],
];
const KEY = 'foodvisor:v1';
const DEFAULT_GOALS = { kcal: 2000, p: 100, c: 250, f: 65 };

const $ = (s) => document.querySelector(s);
const num = (v) => Math.round((parseFloat(v) || 0) * 10) / 10;

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.entries) return { goals: { ...DEFAULT_GOALS, ...d.goals }, entries: d.entries };
  } catch (e) { /* dados corrompidos ou storage indisponível */ }
  return { goals: { ...DEFAULT_GOALS }, entries: {} };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { alert('Não foi possível salvar os dados.'); }
}

const state = load();
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
let day = iso(new Date());

function shiftDay(n) {
  const d = new Date(day + 'T12:00:00');
  d.setDate(d.getDate() + n);
  day = iso(d);
  render();
}

function render() {
  const items = state.entries[day] || [];
  const g = state.goals;
  const sum = (k) => num(items.reduce((a, i) => a + i[k], 0));
  const kcal = sum('kcal');

  $('#date').value = day;
  $('#dateLabel').textContent = new Date(day + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' }) + (day === iso(new Date()) ? ' · hoje' : '');
  $('#kcalTotal').textContent = Math.round(kcal);
  $('#kcalGoal').textContent = g.kcal;
  $('#kcalLeft').textContent = Math.round(g.kcal - kcal);
  const ring = $('#ring');
  ring.style.setProperty('--pct', Math.min(100, g.kcal ? (kcal / g.kcal) * 100 : 0));
  ring.style.setProperty('--ring-color', kcal > g.kcal ? 'var(--danger)' : 'var(--accent)');

  for (const [k, id] of [['p', 'P'], ['c', 'C'], ['f', 'F']]) {
    const m = $('#m' + id);
    m.max = g[k] || 1;
    m.value = sum(k);
    $('#t' + id).textContent = `${sum(k)} / ${g[k]} g`;
  }

  const wrap = $('#meals');
  wrap.textContent = '';
  for (const [id, label] of MEALS) {
    const list = items.map((it, idx) => ({ it, idx })).filter((x) => x.it.meal === id);
    const sec = document.createElement('div');
    sec.className = 'card meal';
    const h = document.createElement('h3');
    h.append(label);
    const small = document.createElement('small');
    small.textContent = Math.round(list.reduce((a, x) => a + x.it.kcal, 0)) + ' kcal';
    h.append(small);
    sec.append(h);
    for (const { it, idx } of list) {
      const row = document.createElement('div');
      row.className = 'item';
      const info = document.createElement('div');
      info.textContent = it.name;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `${it.kcal} kcal · P ${it.p} · C ${it.c} · G ${it.f}`;
      info.append(meta);
      const del = document.createElement('button');
      del.textContent = '×';
      del.setAttribute('aria-label', 'Remover ' + it.name);
      del.onclick = () => { items.splice(idx, 1); state.entries[day] = items; save(); render(); };
      row.append(info, del);
      sec.append(row);
    }
    const add = document.createElement('button');
    add.className = 'add';
    add.textContent = '+ Adicionar';
    add.onclick = () => openDialog(id, label);
    sec.append(add);
    wrap.append(sec);
  }

  const gf = $('#goals');
  for (const k of ['kcal', 'p', 'c', 'f']) gf.elements[k].value = g[k];
}

function recents() {
  const seen = new Map();
  for (const d of Object.keys(state.entries).sort().reverse()) {
    for (const it of state.entries[d]) if (!seen.has(it.name.toLowerCase())) seen.set(it.name.toLowerCase(), it);
  }
  return [...seen.values()].slice(0, 50);
}

const dlg = $('#dlg');
const form = $('#foodForm');
function openDialog(meal, label) {
  form.reset();
  form.elements.meal.value = meal;
  $('#dlgTitle').textContent = 'Adicionar · ' + label;
  const list = recents();
  $('#recents').replaceChildren(...list.map((r) => Object.assign(document.createElement('option'), { value: r.name })));
  dlg.showModal();
  form.elements.name.focus();
}
form.elements.name.addEventListener('change', () => {
  const r = recents().find((x) => x.name.toLowerCase() === form.elements.name.value.toLowerCase());
  if (r) { form.elements.kcal.value = r.kcal; form.elements.p.value = r.p; form.elements.c.value = r.c; form.elements.f.value = r.f; }
});
$('#cancel').onclick = () => dlg.close();
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = form.elements;
  (state.entries[day] ||= []).push({
    meal: f.meal.value, name: f.name.value.trim(), kcal: num(f.kcal.value), p: num(f.p.value), c: num(f.c.value), f: num(f.f.value),
  });
  save();
  dlg.close();
  render();
});

$('#prev').onclick = () => shiftDay(-1);
$('#next').onclick = () => shiftDay(1);
$('#date').onchange = (e) => { if (e.target.value) { day = e.target.value; render(); } };

$('#goals').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target.elements;
  state.goals = { kcal: num(f.kcal.value), p: num(f.p.value), c: num(f.c.value), f: num(f.f.value) };
  save();
  render();
});

$('#export').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  a.download = `foodvisor-backup-${iso(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};
$('#import').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (!d.entries || typeof d.entries !== 'object') throw new Error();
    if (!confirm('Substituir os dados atuais pelo backup?')) return;
    state.goals = { ...DEFAULT_GOALS, ...d.goals };
    state.entries = d.entries;
    save();
    render();
  } catch (err) {
    alert('Arquivo de backup inválido.');
  } finally {
    e.target.value = '';
  }
};

render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
