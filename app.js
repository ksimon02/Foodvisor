'use strict';

/* ================= Constantes ================= */

const KEY = 'foodvisor:v1';
const DEFAULT_GOALS = { kcal: 2000, p: 100, c: 250, f: 65, water: 2000 };

const MEALS = {
  cafe: { label: 'Café da manhã', icon: '☕' },
  lanche_manha: { label: 'Lanche da manhã', icon: '🍎' },
  almoco: { label: 'Almoço', icon: '🥗' },
  lanche: { label: 'Lanche da tarde', icon: '🥪' },
  jantar: { label: 'Jantar', icon: '🍲' },
};
const MEAL_ORDER = Object.keys(MEALS);
// Parte das calorias do dia recomendada para cada refeição, conforme o número de refeições.
const MEAL_SPLIT = {
  3: { cafe: 0.3, almoco: 0.4, jantar: 0.3 },
  4: { cafe: 0.25, almoco: 0.35, lanche: 0.15, jantar: 0.25 },
  5: { cafe: 0.2, lanche_manha: 0.1, almoco: 0.35, lanche: 0.1, jantar: 0.25 },
};
const ACTIVITY = { sedentario: 1.2, leve: 1.375, moderado: 1.55, intenso: 1.725 };
const DIET_EXCLUDES = {
  vegetariana: ['carne', 'peixe', 'mar'],
  pescetariana: ['carne'],
  vegana: ['carne', 'peixe', 'mar', 'ovo', 'leite', 'mel'],
};
const ALLERGENS = { lactose: 'lactose', gluten: 'glúten', nozes: 'oleaginosas', mar: 'frutos do mar', ovo: 'ovo', soja: 'soja' };
const MACROS = [
  ['p', 'Proteínas', 'var(--protein)'],
  ['c', 'Carboidratos', 'var(--carbs)'],
  ['f', 'Gorduras', 'var(--fat)'],
];
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const FOOD_DB = FOODS.map(([name, portion, kcal, p, c, f, tags]) => ({
  name, portion, kcal, p, c, f, tags: tags.split(' ').filter(Boolean),
}));
const findFood = (name) => FOOD_DB.find((f) => f.name === name);

/* ================= Utilidades ================= */

const $ = (s) => document.querySelector(s);
const r1 = (n) => Math.round(n * 10) / 10;
const fmt = (n, d = 0) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: d });
const pct = (a, b) => (b ? Math.min(100, (a / b) * 100) : 0);
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const parseNum = (s) => parseFloat(String(s).replace(',', '.'));
const listPt = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} e ${a[a.length - 1]}` : a[0] || '');

const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const today = () => iso(new Date());
const parse = (s) => new Date(s + 'T12:00:00');
const addDays = (s, n) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
const longDate = (d) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = (d) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
const dayLabel = (s) => {
  if (s === today()) return 'Hoje';
  if (s === addDays(today(), -1)) return 'Ontem';
  return parse(s).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
};

// Cria elementos sem innerHTML: textos entram sempre como texto.
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid);
  return el;
}

// Substitui o conteúdo de uma tela; aceita listas e ignora valores vazios, como h().
const setView = (sel, ...kids) => $(sel).replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ================= Estado ================= */

function load() {
  let d = null;
  try {
    d = JSON.parse(localStorage.getItem(KEY));
  } catch (e) { /* dados corrompidos ou storage indisponível */ }
  if (!d || typeof d !== 'object') d = {};
  return {
    profile: d.profile || null,
    goals: { ...DEFAULT_GOALS, ...d.goals },
    entries: d.entries || {},
    water: d.water || {},
    weights: d.weights || [],
  };
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    alert('Não foi possível salvar os dados.');
  }
}

let state = load();
let day = today();
let tab = 'diario';

const activeMeals = () => Object.keys(MEAL_SPLIT[state.profile?.refeicoes] || MEAL_SPLIT[4]);

function totals(d) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const it of state.entries[d] || []) for (const k in t) t[k] += it[k] || 0;
  return t;
}

function streak() {
  let n = 0;
  let d = today();
  if (!(state.entries[d] || []).length) d = addDays(d, -1);
  while ((state.entries[d] || []).length) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

function logWeight(date, kg) {
  state.weights = state.weights.filter((w) => w.date !== date);
  state.weights.push({ date, kg });
  state.weights.sort((a, b) => (a.date < b.date ? -1 : 1));
}
const currentWeight = () => (state.weights.length ? state.weights[state.weights.length - 1].kg : state.profile.peso);

/* ================= Cálculo do programa ================= */

const isPregnant = (p) => p.sexo === 'feminino' && (p.gestante === 'gravida' || p.gestante === 'amamentando');
const changesWeight = (p) => ['perder', 'ganhar', 'massa'].includes(p.objetivo) && !isPregnant(p);
const healthyRange = (cm) => [18.5, 24.9].map((imc) => r1(imc * (cm / 100) ** 2));
const etaFor = (p, pace) => {
  const d = new Date();
  d.setDate(d.getDate() + Math.ceil((Math.abs(p.peso - p.meta) / pace) * 7));
  return d;
};

// Metabolismo basal pela fórmula de Mifflin-St Jeor; 1 kg ≈ 7700 kcal.
function computePlan(p) {
  const notes = [];
  const bmr = 10 * p.peso + 6.25 * p.altura - 5 * p.idade + (p.sexo === 'masculino' ? 5 : -161);
  const tdee = bmr * (ACTIVITY[p.atividade] || 1.375);
  let kcal = tdee;
  let pace = 0;

  if (isPregnant(p)) {
    notes.push('Durante a gestação ou amamentação não criamos déficit calórico. Converse com seu médico ou nutricionista sobre as suas necessidades.');
  } else if (changesWeight(p)) {
    pace = p.ritmo || 0.5;
    if (p.idade < 18 && pace > 0.25) {
      pace = 0.25;
      notes.push('Para menores de 18 anos usamos o ritmo mais tranquilo. Procure acompanhamento profissional.');
    }
    const delta = (pace * 7700) / 7;
    kcal = p.objetivo === 'perder' ? tdee - delta : tdee + delta;
    const floor = p.sexo === 'masculino' ? 1500 : 1200;
    if (kcal < floor) {
      kcal = floor;
      pace = Math.max(0, ((tdee - floor) * 7) / 7700);
      notes.push(`Para sua segurança a meta não fica abaixo de ${floor} kcal, o que deixa o ritmo em cerca de ${fmt(pace, 2)} kg por semana.`);
    }
  }
  kcal = Math.round(kcal / 10) * 10;

  const proteinPerKg = { perder: 1.6, massa: 1.8, ganhar: 1.4 }[p.objetivo] || 1.2;
  const refWeight = Math.min(p.peso, 25 * (p.altura / 100) ** 2);
  const prot = Math.round(proteinPerKg * refWeight);
  let carb;
  let fat;
  if (p.dieta === 'lowcarb') {
    carb = Math.round((kcal * 0.2) / 4);
    fat = Math.round((kcal - prot * 4 - carb * 4) / 9);
  } else {
    fat = Math.round((kcal * 0.3) / 9);
    carb = Math.round((kcal - prot * 4 - fat * 9) / 4);
  }
  const water = Math.round((p.peso * 35) / 250) * 250;
  const date = pace > 0 && p.meta ? etaFor(p, pace) : null;
  return { tdee: Math.round(tdee), kcal, p: prot, c: Math.max(0, carb), f: Math.max(0, fat), water, pace, date, notes };
}

// Previsão a partir do peso atual e da meta de calorias em uso (que pode ter sido ajustada à mão).
function projection(fromKg) {
  const p = state.profile;
  if (!changesWeight(p) || !p.meta) return null;
  const remaining = p.objetivo === 'perder' ? fromKg - p.meta : p.meta - fromKg;
  if (remaining <= 0) return { done: true };
  const base = computePlan(p);
  const diff = p.objetivo === 'perder' ? base.tdee - state.goals.kcal : state.goals.kcal - base.tdee;
  const pace = (diff * 7) / 7700;
  if (pace < 0.05) return null;
  const date = new Date();
  date.setDate(date.getDate() + Math.ceil((remaining / pace) * 7));
  return { date, pace, remaining };
}

/* ================= Questionário inicial ================= */

const o = (v, icon, label, desc) => ({ v, icon, label, desc });

function paceOptions(p) {
  const list = p.objetivo === 'perder'
    ? [o(0.25, '🐢', 'Tranquilo'), o(0.5, '👍', 'Recomendado'), o(0.75, '🚀', 'Acelerado')]
    : [o(0.25, '👍', 'Tranquilo (recomendado)'), o(0.5, '🚀', 'Acelerado')];
  return list.map((op) => ({ ...op, desc: `${fmt(op.v, 2)} kg por semana · meta em ${shortDate(etaFor(p, op.v))}` }));
}

function validateMeta(v, p) {
  if (p.objetivo === 'perder') {
    if (v >= p.peso) return 'Para perder peso, a meta precisa ser menor que o seu peso atual.';
    const [min] = healthyRange(p.altura);
    if (v < min) return `Esse peso ficaria abaixo da faixa saudável para a sua altura. Escolha pelo menos ${fmt(min, 1)} kg.`;
  } else if (v <= p.peso) {
    return 'Para ganhar peso, a meta precisa ser maior que o seu peso atual.';
  }
  return null;
}

const STEPS = [
  { id: 'intro', type: 'intro' },
  { id: 'nome', short: 'Nome', type: 'text', title: 'Como podemos te chamar?', placeholder: 'Seu nome ou apelido' },
  {
    id: 'objetivo', short: 'Objetivo', type: 'single', title: 'Qual é o seu principal objetivo?',
    options: [o('perder', '🔥', 'Perder peso'), o('manter', '🥗', 'Manter o peso e comer melhor'), o('massa', '💪', 'Ganhar massa muscular'), o('ganhar', '📈', 'Ganhar peso')],
  },
  {
    id: 'motivacao', short: 'Motivação', type: 'multi', title: 'O que te motiva?', subtitle: 'Escolha quantas opções quiser.',
    options: [o('saude', '❤️', 'Cuidar da minha saúde'), o('energia', '⚡', 'Ter mais energia no dia a dia'), o('autoestima', '✨', 'Me sentir bem com meu corpo'), o('esporte', '🏃', 'Melhorar meu desempenho no esporte'), o('evento', '🎉', 'Me preparar para um evento'), o('medico', '🩺', 'Recomendação médica')],
  },
  {
    id: 'sexo', short: 'Sexo', type: 'single', title: 'Qual é o seu sexo biológico?', subtitle: 'Usamos só para estimar o seu metabolismo.',
    options: [o('feminino', '👩', 'Feminino'), o('masculino', '👨', 'Masculino')],
  },
  {
    id: 'gestante', short: 'Gestação', type: 'single', title: 'Você está grávida ou amamentando?', show: (p) => p.sexo === 'feminino',
    options: [o('nao', '🙂', 'Não'), o('gravida', '🤰', 'Estou grávida'), o('amamentando', '🍼', 'Estou amamentando')],
  },
  { id: 'idade', short: 'Idade', type: 'number', title: 'Qual é a sua idade?', unit: 'anos', min: 14, max: 100, int: true },
  { id: 'altura', short: 'Altura', type: 'number', title: 'Qual é a sua altura?', unit: 'cm', min: 120, max: 230, int: true },
  {
    id: 'peso', short: 'Peso inicial', type: 'number', title: 'Qual é o seu peso atual?', unit: 'kg', min: 30, max: 300,
    hint: (p) => p.altura && `Faixa saudável para a sua altura: ${healthyRange(p.altura).map((n) => fmt(n, 1)).join(' a ')} kg`,
  },
  {
    id: 'meta', short: 'Peso desejado', type: 'number', title: 'Qual peso você quer alcançar?', unit: 'kg', min: 30, max: 300,
    show: changesWeight, validate: validateMeta,
    hint: (p) => `Hoje: ${fmt(p.peso, 1)} kg · faixa saudável: ${healthyRange(p.altura).map((n) => fmt(n, 1)).join(' a ')} kg`,
  },
  {
    id: 'ritmo', short: 'Ritmo', type: 'single', show: changesWeight, options: paceOptions,
    title: (p) => (p.objetivo === 'perder' ? 'Em que ritmo você quer perder peso?' : 'Em que ritmo você quer ganhar peso?'),
    subtitle: 'Ritmos mais tranquilos são mais fáceis de manter.',
  },
  {
    id: 'atividade', short: 'Atividade', type: 'single', title: 'Qual é o seu nível de atividade?',
    options: [
      o('sedentario', '🛋️', 'Pouco ativo', 'Trabalho sentado e quase não me exercito'),
      o('leve', '🚶', 'Levemente ativo', 'Caminho no dia a dia ou treino 1 a 2 vezes por semana'),
      o('moderado', '🏃', 'Ativo', 'Treino de 3 a 5 vezes por semana'),
      o('intenso', '🏋️', 'Muito ativo', 'Treino pesado quase todo dia ou trabalho físico'),
    ],
  },
  {
    id: 'dieta', short: 'Alimentação', type: 'single', title: 'Como é a sua alimentação?',
    options: [
      o('classica', '🍽️', 'Clássica', 'Como de tudo'),
      o('vegetariana', '🥚', 'Vegetariana', 'Sem carnes nem peixes'),
      o('vegana', '🌱', 'Vegana', 'Nada de origem animal'),
      o('pescetariana', '🐟', 'Pescetariana', 'Sem carnes, mas como peixes'),
      o('lowcarb', '🥩', 'Low carb', 'Poucos carboidratos'),
    ],
  },
  {
    id: 'alergias', short: 'Alergias', type: 'multi', none: 'nenhuma', title: 'Você tem alguma alergia ou intolerância?',
    options: [o('nenhuma', '👍', 'Nenhuma'), o('lactose', '🥛', 'Lactose'), o('gluten', '🌾', 'Glúten'), o('nozes', '🥜', 'Amendoim e oleaginosas'), o('mar', '🦐', 'Frutos do mar'), o('ovo', '🥚', 'Ovo'), o('soja', '🫘', 'Soja')],
  },
  {
    id: 'refeicoes', short: 'Refeições por dia', type: 'single', title: 'Quantas refeições você faz por dia?',
    options: [o(3, '3️⃣', '3 refeições', 'Café da manhã, almoço e jantar'), o(4, '4️⃣', '4 refeições', 'Mais um lanche à tarde'), o(5, '5️⃣', '5 refeições', 'Mais lanches de manhã e à tarde')],
  },
  {
    id: 'desafios', short: 'Desafios', type: 'multi', none: 'nenhum', title: 'Quais são os seus maiores desafios?', subtitle: 'Vamos usar isso para personalizar suas dicas.',
    options: [o('beliscar', '🍪', 'Beliscar entre as refeições'), o('doces', '🍫', 'Vontade de doces'), o('ansiedade', '😰', 'Comer por ansiedade ou estresse'), o('noite', '🌙', 'Comer muito à noite'), o('tempo', '⏱️', 'Falta de tempo para cozinhar'), o('fora', '🍔', 'Comer fora com frequência'), o('agua', '💧', 'Beber pouca água'), o('nenhum', '😎', 'Nenhum desses')],
  },
  { id: 'plano', type: 'plan' },
];

let draft = {};
let obIndex = 0;
let editing = false;
let planTimer;
const visibleSteps = () => STEPS.filter((s) => !s.show || s.show(draft));
const resolve = (x) => (typeof x === 'function' ? x(draft) : x);

function startOnboarding(edit) {
  editing = edit;
  draft = edit ? { ...state.profile } : {};
  obIndex = edit ? 1 : 0;
  $('#app').hidden = true;
  $('#onboarding').hidden = false;
  renderStep();
}

function go(dir) {
  if (dir < 0 && obIndex <= (editing ? 1 : 0)) {
    if (state.profile) showApp();
    return;
  }
  obIndex += dir;
  renderStep();
  window.scrollTo(0, 0);
}

function renderStep() {
  clearTimeout(planTimer);
  const steps = visibleSteps();
  obIndex = Math.max(0, Math.min(obIndex, steps.length - 1));
  const step = steps[obIndex];
  $('#obBar').style.width = `${((obIndex + 1) / steps.length) * 100}%`;
  $('#obBack').style.visibility = obIndex > 0 || state.profile ? 'visible' : 'hidden';

  const eta = $('#obEta');
  const showEta = draft.meta && changesWeight(draft) && !['ritmo', 'plano', 'meta'].includes(step.id);
  eta.hidden = !showEta;
  if (showEta) eta.textContent = `🎯 ${fmt(draft.meta, 1)} kg em ${shortDate(etaFor(draft, draft.ritmo || 0.5))}`;

  const box = $('#obStep');
  box.className = 'ob-step' + (step.type === 'intro' ? ' intro' : '');
  box.replaceChildren();
  const next = $('#obNext');
  next.hidden = false;
  next.disabled = false;
  next.textContent = 'Continuar';
  next.onclick = () => go(1);

  if (step.type === 'intro') {
    box.append(
      h('img', { src: 'icons/avocado.svg', class: 'mascot-lg', alt: '' }),
      h('h1', { text: 'Vamos montar o seu programa' }),
      h('p', { class: 'ob-sub', text: 'Responda algumas perguntas rápidas. Com elas calculamos suas metas de calorias, macronutrientes e água, e personalizamos dicas e ideias de refeições para você.' }),
    );
    next.textContent = 'Começar';
    return;
  }

  if (step.title) box.append(h('h1', { text: resolve(step.title) }));
  if (step.subtitle) box.append(h('p', { class: 'ob-sub', text: resolve(step.subtitle) }));

  if (step.type === 'single') {
    next.hidden = true;
    box.append(h('div', { class: 'options' }, resolve(step.options).map((op) => h('button', {
      type: 'button',
      class: 'option' + (String(draft[step.id]) === String(op.v) ? ' selected' : ''),
      onclick: (e) => {
        draft[step.id] = op.v;
        box.querySelectorAll('.option').forEach((b) => b.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
        setTimeout(() => go(1), 180);
      },
    }, h('span', { class: 'opt-icon', text: op.icon }), h('span', { class: 'opt-text' }, h('b', { text: op.label }), op.desc && h('small', { text: op.desc }))))));
  } else if (step.type === 'multi') {
    const sel = new Set(draft[step.id] || []);
    next.disabled = sel.size === 0;
    box.append(h('div', { class: 'options' }, step.options.map((op) => h('button', {
      type: 'button',
      class: 'option' + (sel.has(op.v) ? ' selected' : ''),
      'aria-pressed': String(sel.has(op.v)),
      onclick: () => {
        if (sel.has(op.v)) sel.delete(op.v);
        else if (op.v === step.none) {
          sel.clear();
          sel.add(op.v);
        } else {
          sel.delete(step.none);
          sel.add(op.v);
        }
        draft[step.id] = [...sel];
        renderStep();
      },
    }, h('span', { class: 'opt-icon', text: op.icon }), h('span', { class: 'opt-text' }, h('b', { text: op.label }))))));
  } else if (step.type === 'number') {
    const input = h('input', { type: 'text', inputmode: step.int ? 'numeric' : 'decimal', value: draft[step.id] != null ? String(draft[step.id]).replace('.', ',') : '', 'aria-label': resolve(step.title) });
    const err = h('p', { class: 'ob-error' });
    const hint = step.hint && step.hint(draft);
    box.append(h('div', { class: 'num-field' }, input, h('span', { text: step.unit })), err, hint && h('p', { class: 'ob-hint', text: hint }));
    const submit = () => {
      const v = parseNum(input.value);
      if (!(v >= step.min && v <= step.max)) {
        err.textContent = `Informe um valor entre ${step.min} e ${step.max} ${step.unit}.`;
        return;
      }
      const value = step.int ? Math.round(v) : r1(v);
      const msg = step.validate && step.validate(value, draft);
      if (msg) {
        err.textContent = msg;
        return;
      }
      draft[step.id] = value;
      go(1);
    };
    next.onclick = submit;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    setTimeout(() => input.focus(), 60);
  } else if (step.type === 'text') {
    const input = h('input', { type: 'text', class: 'text-field', value: draft[step.id] || '', placeholder: step.placeholder, maxlength: 30, autocomplete: 'given-name' });
    box.append(input, h('p', { class: 'ob-hint', text: 'Opcional' }));
    const submit = () => {
      draft[step.id] = input.value.trim();
      go(1);
    };
    next.onclick = submit;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    setTimeout(() => input.focus(), 60);
  } else if (step.type === 'plan') {
    next.hidden = true;
    box.append(h('div', { class: 'loading' }, h('img', { src: 'icons/avocado.svg', class: 'mascot-lg spin', alt: '' }), h('p', { text: 'Criando o seu programa personalizado…' })));
    planTimer = setTimeout(() => {
      const plan = computePlan(draft);
      box.replaceChildren(
        h('h1', { text: `Seu programa está pronto${draft.nome ? ', ' + draft.nome : ''}! 🎉` }),
        planSummary(plan, draft),
        h('p', { class: 'fine', text: 'Metas estimadas pela fórmula de Mifflin-St Jeor. Elas não substituem a orientação de um nutricionista ou médico.' }),
      );
      next.hidden = false;
      next.textContent = 'Começar meu diário';
      next.onclick = () => finishOnboarding(plan);
    }, editing ? 300 : 1200);
  }
}

function finishOnboarding(plan) {
  state.profile = { ...draft, criadoEm: state.profile?.criadoEm || today() };
  state.goals = { kcal: plan.kcal, p: plan.p, c: plan.c, f: plan.f, water: plan.water };
  logWeight(today(), draft.peso);
  save();
  tab = 'diario';
  showApp();
  toast('Programa salvo! Bom começo 🥑');
}

function planSummary(plan, p) {
  const split = MEAL_SPLIT[p.refeicoes] || MEAL_SPLIT[4];
  return h('div', { class: 'plan' },
    h('div', { class: 'plan-kcal' }, h('small', { text: 'Meta diária' }), h('b', { text: fmt(plan.kcal) }), h('span', { text: 'kcal' })),
    h('div', { class: 'plan-macros' }, MACROS.map(([k, label, color]) => h('div', { class: 'macro-chip', style: `--c:${color}` }, h('b', { text: `${fmt(plan[k])} g` }), h('small', { text: label })))),
    h('div', { class: 'plan-row' }, h('span', { text: '💧 Água' }), h('b', { text: `${fmt(plan.water / 1000, 2)} L por dia` })),
    plan.date && h('div', { class: 'plan-row' }, h('span', { text: '🎯 Meta' }), h('b', { text: `${fmt(p.meta, 1)} kg em ${longDate(plan.date)}` })),
    h('div', { class: 'plan-meals' }, Object.keys(split).map((m) => h('div', { class: 'plan-row' }, h('span', { text: `${MEALS[m].icon} ${MEALS[m].label}` }), h('b', { text: `${fmt(plan.kcal * split[m])} kcal` })))),
    plan.notes.map((n) => h('p', { class: 'note', text: n })),
  );
}

/* ================= Personalização ================= */

const fitsDiet = (f) => !(DIET_EXCLUDES[state.profile.dieta] || []).some((t) => f.tags.includes(t));
const allergensIn = (f) => (state.profile.alergias || []).filter((a) => ALLERGENS[a] && f.tags.includes(a)).map((a) => ALLERGENS[a]);
const suitable = (f) => fitsDiet(f) && !allergensIn(f).length;

function tipsFor(p) {
  const g = state.goals;
  const perMealProt = Math.round(g.p / activeMeals().length);
  const goalTips = {
    perder: [['🥦', 'Encha metade do prato com vegetais: eles dão volume e saciedade com poucas calorias.'], ['🍗', `Inclua proteína em todas as refeições (cerca de ${perMealProt} g em cada) para sentir menos fome ao longo do dia.`]],
    manter: [['🍽️', 'Monte o prato com metade de vegetais, ¼ de proteína e ¼ de carboidratos, de preferência integrais.'], ['🌈', 'Varie as cores do prato: cada cor traz vitaminas e minerais diferentes.']],
    massa: [['💪', `Distribua a proteína ao longo do dia: cerca de ${perMealProt} g por refeição ajudam a construir músculo.`], ['🏋️', 'O superávit calórico só vira músculo com treino de força regular. Combine os dois!']],
    ganhar: [['🥑', 'Inclua alimentos nutritivos e calóricos, como abacate, castanhas, pasta de amendoim e azeite.'], ['⏰', 'Não pule refeições: comer em horários regulares facilita bater a meta de calorias.']],
  };
  const tips = [...(goalTips[p.objetivo] || goalTips.manter)];
  const challenges = {
    beliscar: ['🍎', 'Deixe os lanches planejados: ter algo definido evita beliscar por impulso entre as refeições.'],
    doces: ['🍓', 'Tenha frutas à mão para a vontade de doce. Se for comer sobremesa, prefira logo depois do almoço.'],
    ansiedade: ['🧘', 'Antes de comer por impulso, beba um copo de água e espere 10 minutos. Se a fome continuar, coma com calma e atenção.'],
    noite: ['🌙', 'Capriche no café da manhã e no almoço para chegar ao jantar com menos fome.'],
    tempo: ['⏱️', 'Cozinhe em maior quantidade no fim de semana e congele porções para os dias corridos.'],
    fora: ['🍴', 'Em restaurantes, comece pela salada e prefira grelhados, assados e cozidos a frituras.'],
    agua: ['💧', `Deixe uma garrafa sempre à vista. Sua meta é ${fmt(g.water / 1000, 2)} L por dia.`],
  };
  for (const c of p.desafios || []) if (challenges[c]) tips.push(challenges[c]);
  const diets = {
    vegana: ['🌱', 'Combine leguminosas e cereais (como arroz e feijão) para ter proteínas completas, e converse com um profissional sobre suplementar vitamina B12.'],
    vegetariana: ['🥚', 'Ovos, laticínios, feijões, lentilha e tofu ajudam a bater sua meta de proteína.'],
    pescetariana: ['🐟', 'Coma peixes gordurosos, como salmão e sardinha, duas vezes por semana por causa do ômega-3.'],
    lowcarb: ['🥩', 'Priorize proteínas, vegetais folhosos e gorduras boas, e reduza açúcar e farinha branca.'],
  };
  if (diets[p.dieta]) tips.push(diets[p.dieta]);
  const motivations = {
    saude: ['❤️', 'Prefira alimentos in natura e minimamente processados e deixe os ultraprocessados para ocasiões especiais.'],
    energia: ['⚡', 'Prefira carboidratos integrais e evite passar muitas horas sem comer para manter a energia estável.'],
    autoestima: ['✨', 'Comemore cada pequena conquista, não só o número na balança: energia, sono e disposição também contam.'],
    esporte: ['🏃', 'Em dias de treino, faça uma refeição com carboidrato e proteína 1 a 2 horas antes e depois do exercício.'],
    evento: ['🎉', 'Para o seu evento, constância vale mais que dieta radical: pequenos ajustes diários somam muito.'],
    medico: ['🩺', 'Siga as orientações do seu médico. As metas deste app são estimativas.'],
  };
  for (const m of p.motivacao || []) if (motivations[m]) tips.push(motivations[m]);
  const allergies = (p.alergias || []).filter((a) => ALLERGENS[a]).map((a) => ALLERGENS[a]);
  if (allergies.length) tips.push(['⚠️', `Alimentos com ${listPt(allergies)} aparecem com aviso na busca e ficam fora das sugestões.`]);
  return tips;
}

function combosFor(type) {
  const p = state.profile;
  const list = COMBOS.filter(([t]) => t === type).map(([t, name, items]) => {
    const foods = items.map(([n, q]) => ({ food: findFood(n), qty: q }));
    const tot = { kcal: 0, p: 0, c: 0, f: 0 };
    for (const { food, qty } of foods) for (const k in tot) tot[k] += food[k] * qty;
    return { type: t, name, foods, tot };
  }).filter((c) => c.foods.every(({ food }) => suitable(food)) && (p.dieta !== 'lowcarb' || c.tot.c <= 25));
  const sorters = {
    perder: (a, b) => a.tot.kcal - b.tot.kcal,
    massa: (a, b) => b.tot.p - a.tot.p,
    ganhar: (a, b) => b.tot.kcal - a.tot.kcal,
  };
  if (sorters[p.objetivo]) list.sort(sorters[p.objetivo]);
  return list;
}

function mealForNow() {
  const hr = new Date().getHours();
  const act = activeMeals();
  const pick = hr < 10 ? 'cafe' : hr < 12 ? 'lanche_manha' : hr < 15 ? 'almoco' : hr < 18 ? 'lanche' : 'jantar';
  if (act.includes(pick)) return pick;
  if (pick === 'lanche_manha') return act.includes('lanche') ? 'lanche' : 'almoco';
  return 'jantar';
}

/* ================= Telas do app ================= */

function showApp() {
  $('#onboarding').hidden = true;
  $('#app').hidden = false;
  render();
}

function render() {
  for (const t of ['diario', 'progresso', 'plano', 'perfil']) $('#view-' + t).hidden = t !== tab;
  document.querySelectorAll('.tabbar [data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  ({ diario: renderDiario, progresso: renderProgresso, plano: renderPlano, perfil: renderPerfil })[tab]();
}

const mascot = () => h('img', { src: 'icons/avocado.svg', class: 'mascot-sm', alt: '' });

function entryDesc(it) {
  const q = it.qty && it.qty !== 1 ? `${fmt(it.qty, 2)} × ` : '';
  const portion = it.portion ? `${q}${it.portion} · ` : '';
  return `${portion}P ${fmt(it.p)} g · C ${fmt(it.c)} g · G ${fmt(it.f)} g`;
}

function renderDiario() {
  const p = state.profile;
  const g = state.goals;
  const t = totals(day);
  const left = Math.round(g.kcal - t.kcal);
  const s = streak();
  const items = state.entries[day] || [];
  const split = MEAL_SPLIT[p.refeicoes] || MEAL_SPLIT[4];
  const weekStart = addDays(day, -parse(day).getDay());
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const meals = MEAL_ORDER.filter((m) => m in split || items.some((it) => it.meal === m));
  const tips = tipsFor(p);
  const tip = tips[Math.floor(parse(day).getTime() / 864e5) % tips.length];
  const ml = state.water[day] || 0;
  const glasses = Math.round(ml / 250);
  const glassCount = Math.max(Math.ceil(g.water / 250), glasses + 1);

  setView('#view-diario',
    h('header', { class: 'top' },
      h('div', {},
        h('h1', { text: `Olá${p.nome ? ', ' + p.nome : ''}! 👋` }),
        h('div', { class: 'sub', text: s ? `🔥 ${s} ${s === 1 ? 'dia seguido' : 'dias seguidos'} registrando` : 'Vamos registrar a primeira refeição de hoje?' })),
      mascot()),
    h('div', { class: 'week' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Semana anterior', onclick: () => { day = addDays(day, -7); render(); } }, '‹'),
      h('div', { class: 'week-days' }, week.map((d) => h('button', {
        type: 'button',
        class: 'day' + (d === day ? ' sel' : '') + (d === today() ? ' today' : '') + ((state.entries[d] || []).length ? ' has' : ''),
        'aria-label': dayLabel(d),
        onclick: () => { day = d; render(); },
      }, WEEKDAYS[parse(d).getDay()], h('b', { text: parse(d).getDate() })))),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Próxima semana', onclick: () => { day = addDays(day, 7); render(); } }, '›')),
    h('p', { class: 'day-label', text: dayLabel(day) }),
    h('div', { class: 'card hero' },
      h('div', { class: 'hero-side' }, h('b', { text: fmt(t.kcal) }), h('span', { text: 'consumidas' })),
      h('div', { class: 'ring', style: `--pct:${pct(t.kcal, g.kcal)}${left < 0 ? ';--ring-color:var(--danger)' : ''}` },
        h('b', { text: fmt(Math.abs(left)) }), h('span', { text: left < 0 ? 'kcal acima' : 'kcal restantes' })),
      h('div', { class: 'hero-side' }, h('b', { text: fmt(g.kcal) }), h('span', { text: 'meta' })),
      h('div', { class: 'macros' }, MACROS.map(([k, label, color]) => h('div', { class: 'macro' },
        h('small', { text: label }),
        h('div', { class: 'bar' }, h('i', { style: `--w:${pct(t[k], g[k])}%;--c:${color}` })),
        h('b', { text: `${fmt(t[k])} / ${fmt(g[k])} g` }))))),
    meals.map((m) => {
      const list = items.map((it, idx) => ({ it, idx })).filter((x) => x.it.meal === m);
      const kcal = list.reduce((a, x) => a + x.it.kcal, 0);
      const rec = split[m] ? Math.round(g.kcal * split[m]) : null;
      return h('div', { class: 'card meal' },
        h('div', { class: 'meal-head' },
          h('span', { class: 'meal-icon', text: MEALS[m].icon }),
          h('div', {}, h('h3', { text: MEALS[m].label }), h('small', { text: rec ? `${fmt(kcal)} de ${fmt(rec)} kcal recomendadas` : `${fmt(kcal)} kcal` })),
          h('button', { type: 'button', class: 'add-btn', 'aria-label': `Adicionar em ${MEALS[m].label}`, onclick: () => openAdd(m) }, '+')),
        list.map(({ it, idx }) => h('div', { class: 'item' },
          h('div', {}, it.name, h('small', { text: entryDesc(it) })),
          h('span', { class: 'kcal', text: `${fmt(it.kcal)} kcal` }),
          h('button', { type: 'button', class: 'del', 'aria-label': `Remover ${it.name}`, onclick: () => removeEntry(idx) }, '✕'))));
    }),
    h('div', { class: 'card' },
      h('div', { class: 'water-head' }, h('h2', { text: '💧 Água' }), h('b', { text: `${fmt(ml / 1000, 2)} / ${fmt(g.water / 1000, 2)} L` })),
      h('div', { class: 'glasses' }, Array.from({ length: glassCount }, (_, i) => h('button', {
        type: 'button',
        class: 'glass' + (i < glasses ? ' on' : ''),
        'aria-label': `${i + 1} ${i ? 'copos' : 'copo'}`,
        onclick: () => {
          state.water[day] = (i + 1 === glasses ? i : i + 1) * 250;
          save();
          render();
        },
      }))),
      h('small', { class: 'muted', text: 'Cada copo tem 250 ml. Toque para marcar.' })),
    h('div', { class: 'card tip' },
      h('span', { class: 'emoji', text: tip[0] }),
      h('div', {}, h('small', { text: 'Dica do dia' }), h('p', { text: tip[1] }))),
  );
}

function removeEntry(idx) {
  const items = state.entries[day] || [];
  const [removed] = items.splice(idx, 1);
  if (!items.length) delete state.entries[day];
  save();
  render();
  if (removed) toast(`${removed.name} removido`);
}

function weightChart() {
  const pts = state.weights.slice(-30);
  if (pts.length < 2) return h('p', { class: 'muted', text: 'Registre o seu peso em dias diferentes para ver o gráfico.' });
  const p = state.profile;
  const target = changesWeight(p) && p.meta ? p.meta : null;
  const W = 320, H = 170, L = 34, R = 12, T = 12, B = 22;
  const vals = pts.map((w) => w.kg).concat(target == null ? [] : [target]);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  const pad = Math.max(0.5, (max - min) * 0.15);
  min -= pad;
  max += pad;
  const t0 = parse(pts[0].date).getTime();
  const span = parse(pts[pts.length - 1].date).getTime() - t0 || 1;
  const x = (d) => L + 10 + ((W - L - R - 20) * (parse(d).getTime() - t0)) / span;
  const y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min));
  const path = pts.map((w, i) => `${i ? 'L' : 'M'}${x(w.date).toFixed(1)},${y(w.kg).toFixed(1)}`).join('');
  const ddmm = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de peso">`;
  for (const v of [max - pad, min + pad]) {
    svg += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="lbl" x="${L - 4}" y="${y(v) + 3}" text-anchor="end">${fmt(v, 1)}</text>`;
  }
  if (target != null) svg += `<line class="goal" x1="${L}" x2="${W - R}" y1="${y(target)}" y2="${y(target)}"/><text class="lbl" x="${W - R}" y="${y(target) - 4}" text-anchor="end">meta ${fmt(target, 1)}</text>`;
  svg += `<path class="line" d="${path}"/>`;
  for (const w of pts) svg += `<circle class="dot" cx="${x(w.date)}" cy="${y(w.kg)}" r="3.5"/>`;
  svg += `<text class="lbl" x="${L}" y="${H - 4}">${ddmm(pts[0].date)}</text><text class="lbl" x="${W - R}" y="${H - 4}" text-anchor="end">${ddmm(pts[pts.length - 1].date)}</text></svg>`;
  const el = h('div', { class: 'chart' });
  el.innerHTML = svg; // somente números e datas gerados aqui
  return el;
}

function kcalChart() {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
  const vals = days.map((d) => totals(d).kcal);
  const goal = state.goals.kcal;
  const W = 320, H = 150, T = 10, B = 22;
  const max = Math.max(goal * 1.25, ...vals);
  const bw = 26;
  const gap = (W - bw * 7) / 7;
  const y = (v) => T + (H - T - B) * (1 - v / max);
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Calorias dos últimos 7 dias">`;
  days.forEach((d, i) => {
    const x = gap / 2 + i * (bw + gap);
    const v = vals[i];
    const cls = v === 0 ? 'barr empty' : v > goal * 1.05 ? 'barr over' : 'barr';
    const top = v === 0 ? H - B - 4 : y(v);
    svg += `<rect class="${cls}" x="${x}" y="${top}" width="${bw}" height="${H - B - top}" rx="7"/>`;
    svg += `<text class="lbl" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${WEEKDAYS[parse(d).getDay()]}</text>`;
  });
  svg += `<line class="goal" x1="0" x2="${W}" y1="${y(goal)}" y2="${y(goal)}"/></svg>`;
  const el = h('div', { class: 'chart' });
  el.innerHTML = svg; // somente números gerados aqui
  return el;
}

function renderProgresso() {
  const p = state.profile;
  const cur = currentWeight();
  const first = state.weights.length ? state.weights[0].kg : p.peso;
  const target = changesWeight(p) && p.meta ? p.meta : null;
  const proj = projection(cur);
  const progress = target != null && first !== target ? Math.max(0, Math.min(100, ((first - cur) / (first - target)) * 100)) : null;
  const week = Array.from({ length: 7 }, (_, i) => totals(addDays(today(), i - 6)).kcal).filter((k) => k > 0);
  const avg = week.length ? week.reduce((a, b) => a + b, 0) / week.length : 0;
  const s = streak();
  const logged = Object.keys(state.entries).filter((d) => state.entries[d].length).length;

  const input = h('input', { type: 'text', inputmode: 'decimal', placeholder: `${fmt(cur, 1)} kg`, 'aria-label': 'Peso de hoje em kg' });
  const submit = (e) => {
    e.preventDefault();
    const kg = parseNum(input.value);
    if (!(kg >= 20 && kg <= 400)) {
      toast('Informe um peso válido em kg.');
      return;
    }
    logWeight(today(), r1(kg));
    save();
    render();
    toast('Peso registrado ✅');
  };

  setView('#view-progresso',
    h('header', { class: 'top' }, h('div', {}, h('h1', { text: 'Progresso' }), h('div', { class: 'sub', text: 'Acompanhe o seu peso e as suas calorias' })), mascot()),
    h('div', { class: 'card' },
      h('h2', { text: '⚖️ Peso' }),
      h('div', { class: 'stats' },
        h('div', {}, h('b', { text: fmt(first, 1) }), h('small', { text: 'inicial (kg)' })),
        h('div', {}, h('b', { text: fmt(cur, 1) }), h('small', { text: 'atual (kg)' })),
        h('div', {}, h('b', { text: target != null ? fmt(target, 1) : '—' }), h('small', { text: target != null ? 'meta (kg)' : 'manter' }))),
      progress != null && h('div', { class: 'progress' },
        h('div', { class: 'bar big' }, h('i', { style: `--w:${progress}%;--c:var(--green)` })),
        h('small', { text: proj?.done ? '🎉 Meta alcançada! Que tal definir uma nova no Perfil?' : `${fmt(progress)}% do caminho · faltam ${fmt(Math.abs(cur - target), 1)} kg` })),
      proj?.date && h('p', { class: 'eta', text: `🎯 Previsão: ${longDate(proj.date)}` }),
      weightChart(),
      h('form', { class: 'inline-form', onsubmit: submit }, input, h('button', { type: 'submit', class: 'btn btn-primary' }, 'Registrar'))),
    h('div', { class: 'card' },
      h('h2', { text: '🔥 Calorias nos últimos 7 dias' }),
      kcalChart(),
      h('small', { class: 'muted', text: week.length ? `Média de ${fmt(avg)} kcal nos dias registrados · meta de ${fmt(state.goals.kcal)} kcal (linha tracejada)` : 'Nenhuma refeição registrada nos últimos 7 dias.' })),
    h('div', { class: 'card' },
      h('h2', { text: '🏅 Constância' }),
      h('div', { class: 'stats' },
        h('div', {}, h('b', { text: s }), h('small', { text: s === 1 ? 'dia seguido' : 'dias seguidos' })),
        h('div', {}, h('b', { text: logged }), h('small', { text: 'dias registrados' })),
        h('div', {}, h('b', { text: state.weights.length }), h('small', { text: 'pesagens' })))),
    state.weights.length > 0 && h('div', { class: 'card' },
      h('h2', { text: 'Histórico de peso' }),
      state.weights.slice(-10).reverse().map((w) => h('div', { class: 'kv' },
        h('span', { text: parse(w.date).toLocaleDateString('pt-BR') }),
        h('b', { text: `${fmt(w.kg, 1)} kg` }),
        h('button', {
          type: 'button', class: 'del', 'aria-label': 'Apagar pesagem',
          onclick: () => { state.weights = state.weights.filter((x) => x !== w); save(); render(); },
        }, '✕')))),
  );
}

function renderPlano() {
  const p = state.profile;
  const plan = { ...state.goals, date: projection(currentWeight())?.date || null, notes: computePlan(p).notes };
  const goalLabel = STEPS.find((s) => s.id === 'objetivo').options.find((op) => op.v === p.objetivo)?.label;
  const groups = [['cafe', 'Café da manhã'], ['almoco', 'Almoço e jantar'], ['lanche', 'Lanches']];
  const target = { cafe: () => 'cafe', almoco: () => (new Date().getHours() < 16 ? 'almoco' : 'jantar'), lanche: () => (activeMeals().includes('lanche') ? 'lanche' : mealForNow()) };

  setView('#view-plano',
    h('header', { class: 'top' }, h('div', {}, h('h1', { text: 'Seu plano' }), h('div', { class: 'sub', text: `Objetivo: ${goalLabel}` })), mascot()),
    planSummary(plan, p),
    h('div', { class: 'card' },
      h('h2', { text: '💡 Dicas para você' }),
      h('div', { class: 'tips' }, tipsFor(p).map(([e, text]) => h('div', {}, h('span', { text: e }), h('p', { text }))))),
    h('div', { class: 'card' },
      h('h2', { text: '🍽️ Ideias de refeições' }),
      h('p', { class: 'muted', text: 'Escolhidas de acordo com a sua alimentação, alergias e objetivo.' }),
      groups.map(([type, label]) => {
        const list = combosFor(type).slice(0, 4);
        return list.length > 0 && [h('h3', { class: 'group', text: label }), list.map((c) => h('div', { class: 'combo' },
          h('h3', { text: c.name }),
          h('small', { text: `${fmt(c.tot.kcal)} kcal · P ${fmt(c.tot.p)} g · C ${fmt(c.tot.c)} g · G ${fmt(c.tot.f)} g` }),
          h('small', { text: c.foods.map(({ food, qty }) => (qty !== 1 ? `${fmt(qty, 2)} × ` : '') + food.name).join(' + ') }),
          h('button', {
            type: 'button', class: 'btn btn-ghost',
            onclick: () => {
              const meal = target[type]();
              for (const { food, qty } of c.foods) addEntry(food, qty, meal);
              save();
              toast(`Adicionado em ${MEALS[meal].label} (${dayLabel(day).toLowerCase()})`);
            },
          }, `+ Adicionar ao diário`)))];
      })),
  );
}

function answerText(step, v) {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '—';
  if (step.type === 'number') return `${fmt(v, 1)} ${step.unit}`;
  if (step.type === 'text') return v;
  const opts = typeof step.options === 'function' ? step.options(state.profile) : step.options;
  const label = (x) => opts.find((op) => String(op.v) === String(x))?.label || x;
  return Array.isArray(v) ? v.map(label).join(', ') : label(v);
}

function renderPerfil() {
  const p = state.profile;
  const g = state.goals;
  const fields = [['kcal', 'Calorias (kcal)'], ['p', 'Proteínas (g)'], ['c', 'Carboidratos (g)'], ['f', 'Gorduras (g)'], ['water', 'Água (ml)']];
  const form = h('form', {
    class: 'stack',
    onsubmit: (e) => {
      e.preventDefault();
      const next = {};
      for (const [k] of fields) next[k] = Math.max(0, Math.round(parseNum(form.elements[k].value) || 0));
      if (!next.kcal) {
        toast('Informe a meta de calorias.');
        return;
      }
      state.goals = next;
      save();
      render();
      toast('Metas atualizadas');
    },
  },
  h('div', { class: 'grid2' }, fields.map(([k, label]) => h('label', { class: 'field' }, label, h('input', { name: k, type: 'text', inputmode: 'numeric', value: g[k] })))),
  h('button', { type: 'submit', class: 'btn btn-primary' }, 'Salvar metas'),
  h('button', {
    type: 'button', class: 'btn btn-line',
    onclick: () => {
      const plan = computePlan(p);
      state.goals = { kcal: plan.kcal, p: plan.p, c: plan.c, f: plan.f, water: plan.water };
      save();
      render();
      toast('Metas recalculadas pelo questionário');
    },
  }, 'Recalcular pelo questionário'));

  const fileInput = h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: importBackup });

  setView('#view-perfil',
    h('header', { class: 'top profile-head' },
      h('img', { src: 'icons/avocado.svg', alt: '' }),
      h('div', {}, h('h1', { text: p.nome || 'Seu perfil' }), h('div', { class: 'sub', text: `Desde ${parse(p.criadoEm || today()).toLocaleDateString('pt-BR')}` }))),
    h('div', { class: 'card' },
      h('h2', { text: 'Suas respostas' }),
      STEPS.filter((s) => s.short && (!s.show || s.show(p))).map((s) => h('div', { class: 'kv' }, h('span', { text: s.short }), h('b', { text: answerText(s, p[s.id]) }))),
      h('button', { type: 'button', class: 'btn btn-ghost', style: 'margin-top:12px', onclick: () => startOnboarding(true) }, 'Refazer questionário')),
    h('div', { class: 'card' },
      h('h2', { text: '🎯 Metas diárias' }),
      h('p', { class: 'muted', text: 'Calculadas pelo questionário. Ajuste se o seu nutricionista recomendou outros valores.' }),
      form),
    h('div', { class: 'card' },
      h('h2', { text: '💾 Seus dados' }),
      h('p', { class: 'muted', text: 'Tudo fica salvo só neste aparelho. Faça backup de vez em quando.' }),
      h('div', { class: 'grid2' },
        h('button', { type: 'button', class: 'btn btn-line', onclick: exportBackup }, 'Exportar backup'),
        h('button', { type: 'button', class: 'btn btn-line', onclick: () => fileInput.click() }, 'Importar backup')),
      fileInput),
    h('p', { class: 'fine', text: 'Projeto pessoal inspirado no app Foodvisor, sem nenhuma ligação com a empresa. Valores nutricionais aproximados (Tabela TACO/USDA).' }),
  );
}

function exportBackup() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  a.download = `foodvisor-backup-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (!d || typeof d.entries !== 'object') throw new Error('formato');
    if (!confirm('Substituir os dados atuais pelo backup?')) return;
    localStorage.setItem(KEY, JSON.stringify(d));
    state = load();
    if (state.profile) showApp();
    else startOnboarding(false);
    toast('Backup importado');
  } catch (err) {
    alert('Arquivo de backup inválido.');
  } finally {
    e.target.value = '';
  }
}

/* ================= Adicionar alimentos ================= */

let addMeal = 'almoco';
let pending = null;

function addEntry(food, qty, meal) {
  (state.entries[day] ||= []).push({
    meal, name: food.name, portion: food.portion, qty,
    kcal: r1(food.kcal * qty), p: r1(food.p * qty), c: r1(food.c * qty), f: r1(food.f * qty),
    tags: food.tags || [],
  });
}

function openAdd(meal) {
  addMeal = meal || mealForNow();
  $('#search').value = '';
  renderAddSheet();
  $('#addSheet').showModal();
}

function renderAddSheet() {
  $('#addDay').textContent = dayLabel(day);
  const meals = MEAL_ORDER.filter((m) => activeMeals().includes(m) || m === addMeal);
  $('#mealChips').replaceChildren(...meals.map((m) => h('button', {
    type: 'button',
    class: 'chip' + (m === addMeal ? ' on' : ''),
    onclick: () => { addMeal = m; renderAddSheet(); },
  }, `${MEALS[m].icon} ${MEALS[m].label}`)));
  renderResults();
}

function recents() {
  const seen = new Map();
  for (const d of Object.keys(state.entries).sort().reverse()) {
    for (const it of [...state.entries[d]].reverse()) {
      const k = norm(it.name);
      if (seen.has(k)) continue;
      const q = it.qty || 1;
      seen.set(k, { name: it.name, portion: it.portion || '1 porção', kcal: it.kcal / q, p: it.p / q, c: it.c / q, f: it.f / q, tags: it.tags || [] });
    }
  }
  return [...seen.values()];
}

function foodRow(f) {
  const warn = allergensIn(f);
  return h('button', { type: 'button', class: 'food', onclick: () => openQty(f) },
    h('div', {}, f.name, h('small', { text: f.portion }),
      warn.length > 0 && h('span', { class: 'badge', text: `⚠️ contém ${listPt(warn)}` }),
      !fitsDiet(f) && h('span', { class: 'badge', text: 'fora da sua alimentação' })),
    h('b', { text: `${fmt(f.kcal)} kcal` }));
}

function renderResults() {
  const q = norm($('#search').value.trim());
  const box = $('#results');
  box.replaceChildren();
  if (!q) {
    const rec = recents().slice(0, 8);
    if (rec.length) box.append(h('h3', { text: 'Recentes' }), ...rec.map(foodRow));
    box.append(h('h3', { text: 'Sugestões para você' }), ...FOOD_DB.filter(suitable).map(foodRow));
    return;
  }
  const seen = new Set();
  const res = [...recents(), ...FOOD_DB].filter((f) => {
    const k = norm(f.name);
    if (seen.has(k) || !k.includes(q)) return false;
    seen.add(k);
    return true;
  });
  if (!res.length) box.append(h('p', { class: 'muted', text: 'Nada encontrado. Crie o alimento manualmente logo abaixo.' }));
  box.append(...res.slice(0, 50).map(foodRow));
}

function openQty(f) {
  pending = f;
  $('#qtyName').textContent = f.name;
  $('#qtyPortion').textContent = `Porção: ${f.portion}`;
  const warn = allergensIn(f);
  $('#qtyWarn').hidden = !warn.length;
  $('#qtyWarn').textContent = warn.length ? `⚠️ Atenção: contém ${listPt(warn)}.` : '';
  $('#qtyInput').value = '1';
  updateQty();
  $('#qtySheet').showModal();
}

const readQty = () => {
  const q = parseNum($('#qtyInput').value);
  return q > 0 && q <= 50 ? q : 0;
};

function updateQty() {
  const q = readQty();
  const f = pending;
  $('#qtyMacros').replaceChildren(
    h('div', {}, h('b', { text: fmt(f.kcal * q) }), h('small', { text: 'kcal' })),
    ...MACROS.map(([k, label, color]) => h('div', { style: `--c:${color}` }, h('b', { text: `${fmt(f[k] * q, 1)} g` }), h('small', { text: label }))),
  );
  document.querySelectorAll('#qtyChips .chip').forEach((c) => c.classList.toggle('on', Number(c.dataset.q) === q));
  $('#qtyAdd').disabled = !q;
}

function stepQty(delta) {
  const q = Math.max(0.5, Math.round(((readQty() || 1) + delta) * 2) / 2);
  $('#qtyInput').value = String(q).replace('.', ',');
  updateQty();
}

function confirmAdd(food, qty) {
  addEntry(food, qty, addMeal);
  save();
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  render();
  toast(`${food.name} adicionado em ${MEALS[addMeal].label}`);
}

/* ================= Eventos ================= */

$('#obBack').onclick = () => go(-1);
document.querySelectorAll('.tabbar [data-tab]').forEach((b) => b.addEventListener('click', () => {
  tab = b.dataset.tab;
  render();
  window.scrollTo(0, 0);
}));
$('#fab').onclick = () => openAdd();
$('#search').addEventListener('input', renderResults);
$('#customBtn').onclick = () => {
  const form = $('#customForm');
  form.reset();
  form.elements.name.value = $('#search').value.trim();
  $('#customSheet').showModal();
};
$('#customForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const el = e.target.elements;
  const food = {
    name: el.name.value.trim(),
    portion: el.portion.value.trim() || '1 porção',
    kcal: r1(parseNum(el.kcal.value) || 0),
    p: r1(parseNum(el.p.value) || 0),
    c: r1(parseNum(el.c.value) || 0),
    f: r1(parseNum(el.f.value) || 0),
    tags: [],
  };
  if (!food.name) return;
  confirmAdd(food, 1);
});
$('#qtyInput').addEventListener('input', updateQty);
$('#qtyMinus').onclick = () => stepQty(-0.5);
$('#qtyPlus').onclick = () => stepQty(0.5);
document.querySelectorAll('#qtyChips .chip').forEach((c) => c.addEventListener('click', () => {
  $('#qtyInput').value = c.dataset.q.replace('.', ',');
  updateQty();
}));
$('#qtyAdd').onclick = () => {
  const q = readQty();
  if (q && pending) confirmAdd(pending, q);
};
document.querySelectorAll('dialog').forEach((d) => {
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  d.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => d.close()));
});

if (state.profile) showApp();
else startOnboarding(false);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
