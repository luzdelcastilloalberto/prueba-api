const API = 'https://api.openbrewerydb.org/v1';
const PER_PAGE = 12;

const $ = (id) => document.getElementById(id);
const els = {
  form: $('searchForm'), q: $('q'), country: $('country'), city: $('city'),
  type: $('type'), sort: $('sort'), grid: $('grid'), status: $('status'),
  stats: $('stats'), prev: $('prev'), next: $('next'), pageInfo: $('pageInfo'),
  pager: $('pager'), modal: $('modal'), modalBody: $('modalBody'),
};

const state = { page: 1, query: '' };

const TYPE_LABEL = {
  micro: 'Micro', nano: 'Nano', regional: 'Regional', brewpub: 'Brewpub', large: 'Large',
  planning: 'En proyecto', bar: 'Bar', contract: 'Contract', proprietor: 'Proprietor', closed: 'Cerrada',
};

/* ---------- utilidades ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(path, params = {}) {
  const url = new URL(API + path);
  Object.entries(params).forEach(([k, v]) => v !== '' && v != null && url.searchParams.set(k, v));
  const res = await fetch(url);
  if (!res.ok) throw new Error('Error ' + res.status);
  return res.json();
}

function setStatus(msg, isError = false) {
  els.status.textContent = msg;
  els.status.classList.toggle('error', isError);
}

function showSkeletons() {
  els.grid.innerHTML = Array.from({ length: 6 }, () => '<div class="skeleton"></div>').join('');
}

/* ---------- render ---------- */
function card(b, i) {
  const place = [b.city, b.state_province, b.country].filter(Boolean).join(', ');
  const closed = b.brewery_type === 'closed';
  return `
    <article class="card" tabindex="0" data-id="${esc(b.id)}" style="animation-delay:${i * 40}ms">
      <span class="badge ${closed ? 'closed' : ''}">${esc(TYPE_LABEL[b.brewery_type] || b.brewery_type)}</span>
      <h3>${esc(b.name)}</h3>
      <p class="where">📍 ${esc(place || 'Ubicación desconocida')}</p>
      ${b.website_url ? '<p class="where">🌐 Con web oficial</p>' : ''}
      <span class="more">Ver detalles →</span>
    </article>`;
}

function render(list) {
  if (!list.length) {
    els.grid.innerHTML = '';
    setStatus('😢 No hay cervecerías con esos filtros. Prueba otra búsqueda.');
    return;
  }
  els.grid.innerHTML = list.map(card).join('');
  window.currentList = list;
}

function openModal(b) {
  const addr = [b.address_1, b.postal_code, b.city, b.state_province, b.country].filter(Boolean).join(', ');
  const hasCoords = b.latitude && b.longitude;
  const mapQ = hasCoords ? `${b.latitude},${b.longitude}` : encodeURIComponent(`${b.name} ${addr}`);
  els.modalBody.innerHTML = `
    <span class="badge ${b.brewery_type === 'closed' ? 'closed' : ''}">${esc(TYPE_LABEL[b.brewery_type] || b.brewery_type)}</span>
    <h2>${esc(b.name)}</h2>
    <div class="rows">
      <div><span>📍</span><span>${esc(addr || 'Sin dirección')}</span></div>
      <div><span>📞</span><span>${esc(b.phone || 'Sin teléfono')}</span></div>
      ${hasCoords ? `<div><span>🧭</span><span>${Number(b.latitude).toFixed(4)}, ${Number(b.longitude).toFixed(4)}</span></div>` : ''}
    </div>
    <div class="actions">
      ${b.website_url ? `<a class="btn btn-primary" href="${esc(b.website_url)}" target="_blank" rel="noopener noreferrer">Visitar web</a>` : ''}
      <a class="btn btn-ghost" href="https://www.google.com/maps/search/?api=1&query=${mapQ}" target="_blank" rel="noopener noreferrer">Ver en mapa</a>
    </div>`;
  els.modal.showModal();
}

/* ---------- carga de datos ---------- */
async function load() {
  showSkeletons();
  setStatus('Sirviendo cervezas…');
  try {
    let list;
    if (state.query) {
      // /breweries/search no admite filtros: filtramos en cliente
      list = await api('/breweries/search', { query: state.query, per_page: 50 });
      if (els.type.value) list = list.filter((b) => b.brewery_type === els.type.value);
      if (els.country.value) list = list.filter((b) => b.country === els.country.value);
      if (els.city.value.trim()) list = list.filter((b) => (b.city || '').toLowerCase().includes(els.city.value.trim().toLowerCase()));
      const total = list.length;
      const start = (state.page - 1) * PER_PAGE;
      list = list.slice(start, start + PER_PAGE);
      els.next.disabled = start + PER_PAGE >= total;
      setStatus(total ? `${total} resultados para «${state.query}»` : '');
    } else {
      list = await api('/breweries', {
        by_country: els.country.value,
        by_city: els.city.value.trim().replace(/\s+/g, '_'),
        by_type: els.type.value,
        sort: els.sort.value,
        page: state.page,
        per_page: PER_PAGE,
      });
      els.next.disabled = list.length < PER_PAGE;
      setStatus('');
    }
    els.prev.disabled = state.page === 1;
    els.pageInfo.textContent = `Página ${state.page}`;
    render(list);
  } catch (err) {
    els.grid.innerHTML = '';
    setStatus('🍺 Vaya, la barra está cerrada: ' + err.message + '. Inténtalo de nuevo.', true);
  }
}

function go(page = 1) { state.page = page; load(); }

async function loadCountries() {
  try {
    const data = await api('/breweries/meta', {});
    const byCountry = data.by_country || {};
    Object.keys(byCountry).sort().forEach((c) => {
      els.country.insertAdjacentHTML('beforeend', `<option value="${esc(c)}">${esc(c)} (${byCountry[c]})</option>`);
    });
  } catch {
    ['United States', 'Ireland', 'England', 'Scotland', 'France', 'Austria', 'Poland', 'Portugal', 'South Korea', 'Isle of Man']
      .forEach((c) => els.country.insertAdjacentHTML('beforeend', `<option value="${c}">${c}</option>`));
  }
}

async function loadStats() {
  try {
    const m = await api('/breweries/meta', {});
    const total = Number(m.total) || 0;
    const countries = Object.keys(m.by_country || {}).length;
    const types = Object.keys(m.by_type || {}).length;
    els.stats.innerHTML = `
      <div class="stat"><b>${total.toLocaleString('es-ES')}</b><small>cervecerías</small></div>
      <div class="stat"><b>${countries}</b><small>países</small></div>
      <div class="stat"><b>${types}</b><small>tipos</small></div>`;
  } catch { els.stats.innerHTML = ''; }
}

async function surprise() {
  showSkeletons();
  els.pager.style.visibility = 'hidden';
  try {
    const list = await api('/breweries/random', { size: 3 });
    setStatus('🎲 Tres cervecerías al azar para ti');
    render(list);
  } catch (err) {
    setStatus('No se pudo sacar una al azar: ' + err.message, true);
  }
}

/* ---------- eventos ---------- */
els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  state.query = els.q.value.trim();
  els.pager.style.visibility = 'visible';
  go(1);
  document.querySelector('.filters').scrollIntoView({ behavior: 'smooth' });
});

[els.country, els.type, els.sort].forEach((el) => el.addEventListener('change', () => { els.pager.style.visibility = 'visible'; go(1); }));

let t;
els.city.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => go(1), 450); });

$('btnReset').addEventListener('click', () => {
  els.q.value = ''; state.query = '';
  els.country.value = ''; els.city.value = ''; els.type.value = ''; els.sort.value = 'name:asc';
  els.pager.style.visibility = 'visible';
  go(1);
});
$('btnRandom').addEventListener('click', surprise);

els.prev.addEventListener('click', () => go(state.page - 1));
els.next.addEventListener('click', () => go(state.page + 1));

els.grid.addEventListener('click', (e) => {
  const c = e.target.closest('.card');
  if (c) openModal(window.currentList.find((b) => b.id === c.dataset.id));
});
els.grid.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') e.target.closest('.card')?.click();
});

$('closeModal').addEventListener('click', () => els.modal.close());
els.modal.addEventListener('click', (e) => { if (e.target === els.modal) els.modal.close(); });

/* burbujas de fondo */
const bubbles = document.querySelector('.bubbles');
for (let i = 0; i < 18; i++) {
  const s = document.createElement('span');
  const size = 8 + Math.random() * 28;
  s.style.cssText = `left:${Math.random() * 100}%;width:${size}px;height:${size}px;animation-duration:${10 + Math.random() * 16}s;animation-delay:${-Math.random() * 20}s`;
  bubbles.appendChild(s);
}

/* arranque */
loadStats();
loadCountries();
load();
