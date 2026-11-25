const API = 'https://punkapi-alxiw.amvera.io/v3';
const PER_PAGE = 12;
const $ = (id) => document.getElementById(id);
const els = {
  form: $('searchForm'), q: $('q'), strength: $('strength'), food: $('food'), sort: $('sort'),
  grid: $('grid'), status: $('status'), prev: $('prev'), next: $('next'),
  pageInfo: $('pageInfo'), pager: $('pager'), modal: $('modal'), modalBody: $('modalBody'),
};
const state = { page: 1 };
let current = [];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v));

/* La API puede devolver un array o un objeto que lo envuelve: lo normalizamos. */
function toList(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    for (const k of ['data', 'beers', 'items', 'results']) if (Array.isArray(data[k])) return data[k];
    if (data.id !== undefined || data.name) return [data];
  }
  return [];
}

async function api(path, params = {}) {
  const url = new URL(API + path);
  Object.entries(params).forEach(([k, v]) => v !== '' && v != null && url.searchParams.set(k, v));
  const res = await fetch(url);
  if (!res.ok) throw new Error('Error ' + res.status);
  return toList(await res.json());
}

function setStatus(msg, isError = false) {
  els.status.textContent = msg;
  els.status.classList.toggle('error', isError);
}
const showSkeletons = () => { els.grid.innerHTML = Array.from({ length: 6 }, () => '<div class="skeleton"></div>').join(''); };

/* ---------- render ---------- */
function bottle(b) {
  const img = b.image_url && !/keg\.png/.test(b.image_url) ? `<img src="${esc(b.image_url)}" alt="" loading="lazy" onerror="this.replaceWith('🍺')">` : '🍺';
  return `<div class="bottle">${img}</div>`;
}

function card(b, i) {
  const abv = num(b.abv), ibu = num(b.ibu);
  return `
    <article class="card beer" tabindex="0" data-id="${esc(b.id)}" style="animation-delay:${i * 40}ms">
      ${bottle(b)}
      <div class="info">
        <h3>${esc(b.name)}</h3>
        <p class="tag">${esc(b.tagline || '')}</p>
        <div class="meters">
          ${abv !== null ? `<span class="pill">ABV <b>${abv}%</b></span>` : ''}
          ${ibu !== null ? `<span class="pill">IBU <b>${ibu}</b></span>` : ''}
          ${b.first_brewed ? `<span class="pill">📅 ${esc(b.first_brewed)}</span>` : ''}
        </div>
        ${abv !== null ? `<div class="bar" title="Graduación"><i style="width:${Math.min(abv / 15 * 100, 100)}%"></i></div>` : ''}
        <span class="more">Ver detalles →</span>
      </div>
    </article>`;
}

function render(list) {
  current = list;
  if (!list.length) {
    els.grid.innerHTML = '';
    setStatus('😢 No hay cervezas con esos filtros. Prueba otra búsqueda.');
    return;
  }
  els.grid.innerHTML = list.map(card).join('');
}

function ingredients(ing) {
  if (!ing || typeof ing !== 'object') return '';
  const fmt = (arr) => (Array.isArray(arr) ? arr.map((x) => (typeof x === 'string' ? x : x.name)).filter(Boolean) : []);
  const groups = [['🌾 Malta', fmt(ing.malt)], ['🌿 Lúpulo', [...new Set(fmt(ing.hops))]], ['🧫 Levadura', ing.yeast ? [ing.yeast] : []]];
  return groups.filter(([, v]) => v.length).map(([t, v]) => `<h4>${t}</h4><div class="chips">${v.map((x) => `<span>${esc(x)}</span>`).join('')}</div>`).join('');
}

function openModal(b) {
  const foods = Array.isArray(b.food_pairing) ? b.food_pairing : [];
  const vol = b.volume && b.volume.value ? `${b.volume.value} ${b.volume.unit || ''}` : '';
  els.modalBody.innerHTML = `
    <div class="modal-top">${bottle(b)}<div>
      <h2>${esc(b.name)}</h2><p class="tag">${esc(b.tagline || '')}</p>
      <div class="meters" style="margin-top:8px">
        ${num(b.abv) !== null ? `<span class="pill">ABV <b>${num(b.abv)}%</b></span>` : ''}
        ${num(b.ibu) !== null ? `<span class="pill">IBU <b>${num(b.ibu)}</b></span>` : ''}
        ${num(b.ebc) !== null ? `<span class="pill">EBC <b>${num(b.ebc)}</b></span>` : ''}
        ${num(b.ph) !== null ? `<span class="pill">pH <b>${num(b.ph)}</b></span>` : ''}
        ${vol ? `<span class="pill">${esc(vol)}</span>` : ''}
      </div></div></div>
    ${b.description ? `<p class="desc">${esc(b.description)}</p>` : ''}
    ${foods.length ? `<h4>🍽️ Maridaje</h4><ul>${foods.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
    ${ingredients(b.ingredients)}
    ${b.brewers_tips ? `<h4>💡 Consejo del cervecero</h4><p class="desc">${esc(b.brewers_tips)}</p>` : ''}
    ${b.first_brewed ? `<h4>📅 Primera elaboración</h4><p class="desc">${esc(b.first_brewed)}</p>` : ''}`;
  els.modal.showModal();
}

/* ---------- datos ---------- */
function sortList(list) {
  const s = els.sort.value, by = (k, dir) => (a, c) => dir * ((num(a[k]) ?? -1) - (num(c[k]) ?? -1));
  if (s === 'name') return [...list].sort((a, c) => String(a.name).localeCompare(String(c.name)));
  if (s === 'abv-desc') return [...list].sort(by('abv', -1));
  if (s === 'abv-asc') return [...list].sort(by('abv', 1));
  if (s === 'ibu-desc') return [...list].sort(by('ibu', -1));
  return list;
}

async function load() {
  showSkeletons();
  els.pager.style.visibility = 'visible';
  setStatus('Sirviendo cervezas…');
  const [gt, lt] = els.strength.value ? els.strength.value.split('-') : ['', ''];
  try {
    const list = await api('/beers', {
      page: state.page, per_page: PER_PAGE,
      beer_name: els.q.value.trim().replace(/\s+/g, '_'),
      abv_gt: gt && gt !== '0' ? gt : '', abv_lt: lt && lt !== '100' ? lt : '',
      food: els.food.value.trim().replace(/\s+/g, '_'),
    });
    els.prev.disabled = state.page === 1;
    els.next.disabled = list.length < PER_PAGE;
    els.pageInfo.textContent = `Página ${state.page}`;
    setStatus('');
    render(sortList(list));
  } catch (err) {
    els.grid.innerHTML = '';
    setStatus('🍺 Vaya, la barra está cerrada: ' + err.message + '. Inténtalo de nuevo.', true);
  }
}
const go = (p = 1) => { state.page = p; load(); };

async function surprise() {
  showSkeletons();
  els.pager.style.visibility = 'hidden';
  try {
    const list = await api('/beers/random');
    setStatus('🎲 Tu cerveza sorpresa');
    render(list);
    if (list[0]) openModal(list[0]);
  } catch (err) { setStatus('No se pudo sacar una al azar: ' + err.message, true); }
}

/* ---------- eventos ---------- */
els.form.addEventListener('submit', (e) => { e.preventDefault(); go(1); document.querySelector('.filters').scrollIntoView({ behavior: 'smooth' }); });
[els.strength, els.sort].forEach((el) => el.addEventListener('change', () => go(1)));
let t;
els.food.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => go(1), 450); });
$('btnReset').addEventListener('click', () => { els.q.value = ''; els.food.value = ''; els.strength.value = ''; els.sort.value = 'id'; go(1); });
$('btnRandom').addEventListener('click', surprise);
els.prev.addEventListener('click', () => go(state.page - 1));
els.next.addEventListener('click', () => go(state.page + 1));
els.grid.addEventListener('click', (e) => {
  const c = e.target.closest('.card');
  if (c) { const b = current.find((x) => String(x.id) === c.dataset.id); if (b) openModal(b); }
});
els.grid.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.closest('.card')?.click(); });
$('closeModal').addEventListener('click', () => els.modal.close());
els.modal.addEventListener('click', (e) => { if (e.target === els.modal) els.modal.close(); });

/* burbujas */
const bubbles = document.querySelector('.bubbles');
for (let i = 0; i < 18; i++) {
  const s = document.createElement('span'), size = 8 + Math.random() * 28;
  s.style.cssText = `left:${Math.random() * 100}%;width:${size}px;height:${size}px;animation-duration:${10 + Math.random() * 16}s;animation-delay:${-Math.random() * 20}s`;
  bubbles.appendChild(s);
}

load();
