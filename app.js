const STORAGE_KEY = 'catatan_kas_txns_v1';
const CATEGORIES = {
  income: ['Gaji','Bonus','Usaha','Hadiah','Investasi','Lainnya'],
  expense: ['Makan','Transport','Belanja','Tagihan','Hiburan','Kesehatan','Lainnya']
};
const CATEGORY_ICONS = {
  'Gaji':'fa-money-bill-wave', 'Bonus':'fa-gift', 'Usaha':'fa-briefcase',
  'Hadiah':'fa-gift', 'Investasi':'fa-chart-line',
  'Makan':'fa-utensils', 'Transport':'fa-car', 'Belanja':'fa-bag-shopping',
  'Tagihan':'fa-file-invoice-dollar', 'Hiburan':'fa-film', 'Kesehatan':'fa-heart-pulse',
  'Lainnya':'fa-ellipsis'
};
function catIcon(cat){ return CATEGORY_ICONS[cat] || 'fa-ellipsis'; }

let txns = [];
let currentType = 'income';
let currentFilter = 'all';

function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    txns = raw ? JSON.parse(raw) : [];
  }catch(e){ txns = []; }
}
function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(txns));
}

function formatRupiah(n){
  const sign = n < 0 ? '-' : '';
  return sign + 'Rp ' + Math.abs(Math.round(n)).toLocaleString('id-ID');
}

function todayISO(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}

function openSheet(type){
  currentType = type;
  document.getElementById('sheetTitleText').textContent = type === 'income' ? 'Tambah Pemasukan' : 'Tambah Pengeluaran';
  const tag = document.getElementById('sheetTag');
  tag.textContent = type === 'income' ? 'Masuk' : 'Keluar';
  tag.className = 'tag ' + type;

  const catSelect = document.getElementById('category');
  catSelect.innerHTML = CATEGORIES[type].map(c => `<option value="${c}">${c}</option>`).join('');

  document.getElementById('date').value = todayISO();
  document.getElementById('amount').value = '';
  document.getElementById('note').value = '';

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.style.background = type === 'income' ? 'var(--income)' : 'var(--expense)';

  document.getElementById('overlay').classList.add('open');
  setTimeout(() => document.getElementById('amount').focus(), 50);
}
function closeSheet(){
  document.getElementById('overlay').classList.remove('open');
}
document.getElementById('overlay').addEventListener('click', (e) => {
  if(e.target.id === 'overlay') closeSheet();
});

// Live format ribuan pas ngetik di field amount (mis. 50000 -> 50.000)
const amountInput = document.getElementById('amount');
amountInput.addEventListener('input', (e) => {
  const cursorFromEnd = e.target.value.length - e.target.selectionStart;
  const raw = e.target.value.replace(/\D/g, '');
  const formatted = raw ? parseInt(raw, 10).toLocaleString('id-ID') : '';
  e.target.value = formatted;
  const newPos = Math.max(formatted.length - cursorFromEnd, 0);
  e.target.setSelectionRange(newPos, newPos);
});

function submitForm(e){
  e.preventDefault();
  const amount = parseInt(document.getElementById('amount').value.replace(/\D/g, ''), 10);
  if(!amount || amount <= 0) return;
  const category = document.getElementById('category').value;
  const date = document.getElementById('date').value;
  const note = document.getElementById('note').value.trim();

  txns.push({
    id: Date.now() + '-' + Math.random().toString(36).slice(2,7),
    type: currentType,
    amount, category, date, note
  });
  save();
  closeSheet();
  populateMonths();
  render();
}

function deleteTxn(id){
  txns = txns.filter(t => t.id !== id);
  save();
  render();
}

function toggleMenuPopup(){
  document.getElementById('menuPopup').classList.toggle('open');
}
function closeMenuPopup(){
  document.getElementById('menuPopup').classList.remove('open');
}
document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.menu-wrap');
  if(wrap && !wrap.contains(e.target)) closeMenuPopup();
});
function openResetSheet(){
  document.getElementById('resetOverlay').classList.add('open');
}
function closeResetSheet(){
  document.getElementById('resetOverlay').classList.remove('open');
}
document.getElementById('resetOverlay').addEventListener('click', (e) => {
  if(e.target.id === 'resetOverlay') closeResetSheet();
});
function confirmReset(){
  const scope = document.querySelector('input[name="resetScope"]:checked').value;
  if(scope === 'all'){
    txns = [];
  } else {
    txns = txns.filter(t => t.type !== scope);
  }
  save();
  closeResetSheet();
  populateMonths();
  render();
}

function setFilter(f){
  currentFilter = f;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.filter === f));
  render();
}

function populateMonths(){
  const select = document.getElementById('monthSelect');
  const prevVal = select.value;
  const months = new Set();
  txns.forEach(t => months.add(t.date.slice(0,7)));
  months.add(todayISO().slice(0,7));
  const sorted = Array.from(months).sort().reverse();
  select.innerHTML = '<option value="all">Semua waktu</option>' + sorted.map(m => {
    const [y, mo] = m.split('-');
    const label = new Date(y, mo-1, 1).toLocaleDateString('id-ID', {month:'long', year:'numeric'});
    return `<option value="${m}">${label}</option>`;
  }).join('');
  select.value = prevVal && (prevVal === 'all' || sorted.includes(prevVal)) ? prevVal : sorted[0];
}

function render(){
  const monthFilter = document.getElementById('monthSelect').value;

  const filtered = txns.filter(t => {
    if(monthFilter !== 'all' && t.date.slice(0,7) !== monthFilter) return false;
    if(currentFilter !== 'all' && t.type !== currentFilter) return false;
    return true;
  }).sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  // Summary always based on selected month (or current month if "all")
  const summaryMonth = monthFilter === 'all' ? todayISO().slice(0,7) : monthFilter;
  const monthTxns = txns.filter(t => t.date.slice(0,7) === summaryMonth);
  const monthIncome = monthTxns.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
  const monthExpense = monthTxns.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
  const totalBalance = txns.reduce((s,t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);

  document.getElementById('balanceValue').textContent = formatRupiah(totalBalance);
  document.getElementById('balanceSub').textContent = txns.length + ' transaksi tercatat';
  document.getElementById('incomeValue').textContent = formatRupiah(monthIncome);
  document.getElementById('expenseValue').textContent = formatRupiah(monthExpense);

  const listSection = document.getElementById('listSection');
  if(filtered.length === 0){
    listSection.innerHTML = `
      <div class="empty">
        <div class="empty-icon"><i class="fa-regular fa-folder-open"></i></div>
        <div class="empty-title">Belum ada transaksi</div>
        <div class="empty-sub">Tambah pemasukan atau pengeluaran lewat tombol di atas.</div>
      </div>`;
    return;
  }

  // group by date
  const groups = {};
  filtered.forEach(t => {
    (groups[t.date] = groups[t.date] || []).push(t);
  });

  let html = '';
  Object.keys(groups).sort().reverse().forEach(date => {
    const label = new Date(date + 'T00:00:00').toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
    html += `<div class="day-group"><div class="day-group-label">${label}</div>`;
    groups[date].forEach(t => {
      const isIncome = t.type === 'income';
      html += `
        <div class="txn">
          <div class="txn-dot ${t.type}"><i class="fa-solid ${catIcon(t.category)}"></i></div>
          <div class="txn-info">
            <div class="txn-cat">${t.category}</div>
            ${t.note ? `<div class="txn-note">${escapeHtml(t.note)}</div>` : ''}
          </div>
          <div class="txn-right">
            <div class="txn-amount ${t.type} num">${isIncome ? '+' : '-'}${formatRupiah(t.amount)}</div>
            <button class="txn-del" onclick="deleteTxn('${t.id}')" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </div>`;
    });
    html += `</div>`;
  });
  listSection.innerHTML = html;
}

function escapeHtml(s){
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

load();
populateMonths();
render();

// ============================= //
// PWA: service worker + custom install banner
// ============================= //
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.error('SW register failed:', err));
  });
}

let deferredInstallPrompt = null;
const pwaBanner = document.getElementById('pwaBanner');
const pwaInstallBtn = document.getElementById('pwaInstallBtn');
const pwaCloseBtn = document.getElementById('pwaCloseBtn');
const PWA_DISMISS_KEY = 'pwa_banner_dismissed_v1';

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;

  // Jangan tampil lagi kalau user udah pernah nutup manual
  if (sessionStorage.getItem(PWA_DISMISS_KEY)) return;
  if (window.matchMedia('(display-mode: standalone)').matches) return;

  pwaBanner.classList.add('show');
});

pwaInstallBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  pwaBanner.classList.remove('show');
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
});

pwaCloseBtn.addEventListener('click', () => {
  pwaBanner.classList.remove('show');
  sessionStorage.setItem(PWA_DISMISS_KEY, '1');
});

window.addEventListener('appinstalled', () => {
  pwaBanner.classList.remove('show');
  deferredInstallPrompt = null;
});
