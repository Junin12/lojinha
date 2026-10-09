/* Utilidades gerais: formatação, datas, modal, avisos e imagens */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const view = document.getElementById('view');

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
const round2 = v => Math.round((v + Number.EPSILON) * 100) / 100;
const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = v => isFinite(v) ? (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : '—';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const sum = (arr, fn) => arr.reduce((s, x) => s + fn(x), 0);

/* ---------- Datas (sempre no formato AAAA-MM-DD, horário local) ---------- */
const pad = n => String(n).padStart(2, '0');
const isoDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = s => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDate = s => s ? s.slice(0, 10).split('-').reverse().join('/') : '';
const fmtDateCurto = s => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '';
const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return isoDate(d); };
const diffDays = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
function addMonths(s, n) {
  const d = parseISO(s), dia = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimo));
  return isoDate(d);
}
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/* ---------- Feedback ---------- */
function toast(msg, type = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.className = ''), 3200);
}
const loading = on => $('#loading').classList.toggle('hidden', !on);

function openModal(title, html, onMount) {
  const m = $('#modal');
  m.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Fechar">✕</button></div>
    ${html}</div>`;
  m.classList.remove('hidden');
  m.onclick = e => { if (e.target === m || e.target.closest('[data-close]')) closeModal(); };
  if (onMount) onMount($('.modal-card', m));
}
function closeModal() {
  const m = $('#modal');
  m.classList.add('hidden');
  m.innerHTML = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ---------- Imagens ---------- */
const bgImg = url => url ? `style="background-image:url('${esc(url)}')"` : '';

// Reduz a foto (máx. 1000px, JPEG) para economizar espaço e internet
function compressImage(file, max = 1000, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Não foi possível ler a imagem'));
    img.src = URL.createObjectURL(file);
  });
}

/* ---------- WhatsApp e arquivos ---------- */
function waLink(phone, text) {
  let p = String(phone || '').replace(/\D/g, '');
  if (p && p.length <= 11) p = '55' + p; // número brasileiro sem DDI
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}
const abrirWhats = (phone, text) => window.open(waLink(phone, text), '_blank');

function baixarArquivo(nome, conteudo, tipo = 'application/json') {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
