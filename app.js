const STORAGE_KEY = 'catatan_kas_txns_v1';
const THEME_KEY = 'theme_v1';
const GOAL_KEY = 'savings_goal_v1';
const CHART_COLLAPSE_KEY = 'chart_collapsed_v1';
const CATEGORIES = {
  income: ['Gaji','Bonus','Usaha','Hadiah','Investasi','Uang Saku','Lainnya'],
  expense: ['Makan','Transport','Belanja','Tagihan','Hiburan','Kesehatan','Lainnya']
};
const CATEGORY_ICONS = {
  'Gaji':'fa-money-bill-wave', 'Bonus':'fa-gift', 'Usaha':'fa-briefcase',
  'Hadiah':'fa-gift', 'Investasi':'fa-chart-line', 'Uang Saku':'fa-piggy-bank',
  'Makan':'fa-utensils', 'Transport':'fa-car', 'Belanja':'fa-bag-shopping',
  'Tagihan':'fa-file-invoice-dollar', 'Hiburan':'fa-film', 'Kesehatan':'fa-heart-pulse',
  'Lainnya':'fa-ellipsis'
};
function catIcon(cat){ return CATEGORY_ICONS[cat] || 'fa-ellipsis'; }

let txns = [];
let currentType = 'income';
let currentFilter = 'all';
// Pagination buat daftar transaksi: render banyak ratus/ribuan txn sekaligus
// ke DOM bikin berat, jadi dibatasi per halaman + tombol "muat lebih banyak".
const LIST_PAGE_SIZE = 50;
let listVisibleCount = LIST_PAGE_SIZE;
let lastListKey = '';
let editingId = null;
let savingsGoal = 0;

function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    txns = raw ? JSON.parse(raw) : [];
  }catch(e){ txns = []; }
}
function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(txns));
  syncToServer();
}

function loadGoal(){
  const raw = localStorage.getItem(GOAL_KEY);
  savingsGoal = raw ? parseInt(raw, 10) : 0;
  if(isNaN(savingsGoal)) savingsGoal = 0;
}
function saveGoal(v){
  savingsGoal = v;
  localStorage.setItem(GOAL_KEY, String(v));
  syncToServer();
}

function formatRupiah(n){
  const sign = n < 0 ? '-' : '';
  return sign + 'Rp ' + Math.abs(Math.round(n)).toLocaleString('id-ID');
}

function todayISO(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}

function openSheet(type, editId){
  editingId = editId || null;
  currentType = type;
  const isEdit = !!editingId;

  document.getElementById('sheetTitleText').textContent = isEdit
    ? (type === 'income' ? 'Edit Pemasukan' : 'Edit Pengeluaran')
    : (type === 'income' ? 'Tambah Pemasukan' : 'Tambah Pengeluaran');
  const tag = document.getElementById('sheetTag');
  tag.textContent = type === 'income' ? 'Masuk' : 'Keluar';
  tag.className = 'tag ' + type;

  const catSelect = document.getElementById('category');
  catSelect.innerHTML = CATEGORIES[type].map(c => `<option value="${c}">${c}</option>`).join('');

  if(isEdit){
    const t = txns.find(x => x.id === editId);
    if(t){
      document.getElementById('amount').value = t.amount.toLocaleString('id-ID');
      catSelect.value = t.category;
      document.getElementById('date').value = t.date;
      document.getElementById('note').value = t.note || '';
    }
  } else {
    document.getElementById('date').value = todayISO();
    document.getElementById('amount').value = '';
    document.getElementById('note').value = '';
  }

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.style.background = type === 'income' ? 'var(--income)' : 'var(--expense)';
  submitBtn.textContent = isEdit ? 'Simpan Perubahan' : 'Simpan';

  document.getElementById('overlay').classList.add('open');
  setTimeout(() => document.getElementById('amount').focus(), 50);
}
function closeSheet(){
  document.getElementById('overlay').classList.remove('open');
  editingId = null;
}
document.getElementById('overlay').addEventListener('click', (e) => {
  if(e.target.id === 'overlay') closeSheet();
});

// Live format ribuan pas ngetik di field amount (mis. 50000 -> 50.000)
function attachAmountFormatter(input){
  input.addEventListener('input', (e) => {
    const cursorFromEnd = e.target.value.length - e.target.selectionStart;
    const raw = e.target.value.replace(/\D/g, '');
    const formatted = raw ? parseInt(raw, 10).toLocaleString('id-ID') : '';
    e.target.value = formatted;
    const newPos = Math.max(formatted.length - cursorFromEnd, 0);
    e.target.setSelectionRange(newPos, newPos);
  });
}
attachAmountFormatter(document.getElementById('amount'));
attachAmountFormatter(document.getElementById('goalAmount'));

function submitForm(e){
  e.preventDefault();
  const amount = parseInt(document.getElementById('amount').value.replace(/\D/g, ''), 10);
  if(!amount || amount <= 0) return;
  const category = document.getElementById('category').value;
  const date = document.getElementById('date').value;
  const note = document.getElementById('note').value.trim();

  if(editingId){
    const t = txns.find(x => x.id === editingId);
    if(t){
      t.type = currentType;
      t.amount = amount;
      t.category = category;
      t.date = date;
      t.note = note;
    }
  } else {
    txns.push({
      id: Date.now() + '-' + Math.random().toString(36).slice(2,7),
      type: currentType,
      amount, category, date, note
    });
  }
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

function toggleTxnActive(el, e){
  if(e) e.stopPropagation();
  const wasActive = el.classList.contains('active');
  document.querySelectorAll('.txn.active').forEach(t => t.classList.remove('active'));
  if(!wasActive) el.classList.add('active');
}
document.addEventListener('click', (e) => {
  if(!e.target.closest('.txn')) document.querySelectorAll('.txn.active').forEach(t => t.classList.remove('active'));
});

function openGoalSheet(){
  document.getElementById('goalAmount').value = savingsGoal ? savingsGoal.toLocaleString('id-ID') : '';
  document.getElementById('goalOverlay').classList.add('open');
  setTimeout(() => document.getElementById('goalAmount').focus(), 50);
}
function closeGoalSheet(){
  document.getElementById('goalOverlay').classList.remove('open');
}
document.getElementById('goalOverlay').addEventListener('click', (e) => {
  if(e.target.id === 'goalOverlay') closeGoalSheet();
});
function submitGoal(e){
  e.preventDefault();
  const raw = document.getElementById('goalAmount').value.replace(/\D/g, '');
  saveGoal(raw ? parseInt(raw, 10) : 0);
  closeGoalSheet();
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
document.getElementById('accountOverlay').addEventListener('click', (e) => {
  if(e.target.id === 'accountOverlay') closeAccountSheet();
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

  // Reset pagination tiap kali filter (tipe atau bulan) beneran berubah,
  // tapi tetep kepertahanin kalau render() dipanggil ulang gara-gara data
  // berubah (tambah/edit/hapus) di filter yang sama.
  const listKey = monthFilter + '|' + currentFilter;
  if(listKey !== lastListKey){
    listVisibleCount = LIST_PAGE_SIZE;
    lastListKey = listKey;
  }

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

  renderGoalCard(totalBalance);
  renderChart();

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

  // Cuma render sebagian dulu (pagination) biar DOM gak berat kalau txn udah banyak
  const visible = filtered.slice(0, listVisibleCount);

  // group by date
  const groups = {};
  visible.forEach(t => {
    (groups[t.date] = groups[t.date] || []).push(t);
  });

  let html = '';
  Object.keys(groups).sort().reverse().forEach(date => {
    const label = new Date(date + 'T00:00:00').toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
    html += `<div class="day-group"><div class="day-group-label">${label}</div>`;
    groups[date].forEach(t => {
      const isIncome = t.type === 'income';
      html += `
        <div class="txn" onclick="toggleTxnActive(this, event)">
          <div class="txn-dot ${t.type}"><i class="fa-solid ${catIcon(t.category)}"></i></div>
          <div class="txn-info">
            <div class="txn-cat">${escapeHtml(t.category)}</div>
            ${t.note ? `<div class="txn-note">${escapeHtml(t.note)}</div>` : ''}
          </div>
          <div class="txn-right">
            <div class="txn-amount ${t.type} num">${isIncome ? '+' : '-'}${formatRupiah(t.amount)}</div>
            <button class="txn-edit" onclick="event.stopPropagation(); openSheet('${t.type}','${t.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button class="txn-del" onclick="event.stopPropagation(); deleteTxn('${t.id}')" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </div>`;
    });
    html += `</div>`;
  });

  if(filtered.length > visible.length){
    const sisa = filtered.length - visible.length;
    html += `
      <button type="button" class="load-more-btn" onclick="loadMoreTxns()">
        Muat ${Math.min(sisa, LIST_PAGE_SIZE)} transaksi lagi (${sisa} tersisa)
      </button>`;
  }

  listSection.innerHTML = html;
}

function loadMoreTxns(){
  listVisibleCount += LIST_PAGE_SIZE;
  render();
}

function renderGoalCard(totalBalance){
  const card = document.getElementById('goalCard');
  if(!savingsGoal){
    card.innerHTML = `
      <button class="goal-empty" onclick="openGoalSheet()">
        <i class="fa-solid fa-bullseye"></i>
        <span>Atur target tabungan</span>
      </button>`;
    return;
  }
  const pct = Math.min(100, Math.max(0, (totalBalance / savingsGoal) * 100));
  card.innerHTML = `
    <div class="goal-head">
      <div>
        <div class="card-label">Target Tabungan</div>
        <div class="goal-amounts num">${formatRupiah(totalBalance)} <span class="goal-of">/ ${formatRupiah(savingsGoal)}</span></div>
      </div>
      <button class="goal-edit-btn" onclick="openGoalSheet()" title="Ubah target"><i class="fa-solid fa-pen"></i></button>
    </div>
    <div class="goal-bar"><div class="goal-bar-fill" style="width:${pct}%"></div></div>
    <div class="goal-pct">${pct.toFixed(0)}% tercapai${pct >= 100 ? ' 🎉' : ''}</div>`;
}

function roundRectPath(ctx, x, y, w, h, r){
  const rad = Math.max(0, Math.min(r, w / 2));
  const hh = Math.max(h, 0.001);
  const yy = h >= 0 ? y : y + h;
  ctx.beginPath();
  ctx.moveTo(x + rad, yy);
  ctx.lineTo(x + w - rad, yy);
  ctx.arcTo(x + w, yy, x + w, yy + rad, rad);
  ctx.lineTo(x + w, yy + hh - rad);
  ctx.arcTo(x + w, yy + hh, x + w - rad, yy + hh, rad);
  ctx.lineTo(x + rad, yy + hh);
  ctx.arcTo(x, yy + hh, x, yy + hh - rad, rad);
  ctx.lineTo(x, yy + rad);
  ctx.arcTo(x, yy, x + rad, yy, rad);
  ctx.closePath();
}

// Bikin angka skala sumbu-y yang "rapi" (kelipatan 1/2/5 x 10^n), bukan angka mentah
function niceAxisTicks(maxVal, tickCount){
  if(maxVal <= 0) return [];
  const rawStep = maxVal / tickCount;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  let niceNorm;
  if(norm < 1.5) niceNorm = 1;
  else if(norm < 3) niceNorm = 2;
  else if(norm < 7) niceNorm = 5;
  else niceNorm = 10;
  const step = niceNorm * mag;
  const ticks = [];
  for(let v = step; v <= maxVal + step * 0.5; v += step) ticks.push(Math.round(v));
  return ticks;
}

function renderChart(){
  const chartCard = document.getElementById('chartCard');
  const canvas = document.getElementById('trendChart');
  if(!canvas || !chartCard) return;

  // Belum ada transaksi sama sekali -> jangan tampilkan grafik dulu
  if(txns.length === 0){
    chartCard.style.display = 'none';
    return;
  }
  chartCard.style.display = '';

  // Rentang bulan mengikuti transaksi user: dari bulan transaksi pertama sampai bulan berjalan
  const firstDateStr = txns.reduce((min, t) => t.date < min ? t.date : min, txns[0].date);
  const firstMonth = new Date(firstDateStr.slice(0,4)*1, firstDateStr.slice(5,7)*1 - 1, 1);
  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const months = [];
  let cursor = new Date(firstMonth);
  while(cursor <= currentMonth){
    months.push(cursor.getFullYear() + '-' + String(cursor.getMonth() + 1).padStart(2, '0'));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  const data = months.map(m => {
    const monthTxns = txns.filter(t => t.date.slice(0,7) === m);
    return {
      month: m,
      income: monthTxns.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0),
      expense: monthTxns.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0)
    };
  });
  const maxVal = Math.max(1, ...data.flatMap(d => [d.income, d.expense]));
  const ticks = niceAxisTicks(maxVal, 3);
  const niceMax = ticks.length ? Math.max(maxVal, ticks[ticks.length - 1]) : maxVal;

  const styles = getComputedStyle(document.body);
  const incomeColor = styles.getPropertyValue('--income').trim();
  const expenseColor = styles.getPropertyValue('--expense').trim();
  const textColor = styles.getPropertyValue('--text-faint').trim();
  const gridColor = styles.getPropertyValue('--border').trim();

  // Ukur dulu label nominal paling panjang (mis. "1.000.000"), biar ruang kiri
  // nyesuain otomatis dan gak kepotong pas angkanya makin gede
  const measureCtx = canvas.getContext('2d');
  measureCtx.font = '600 10px "Plus Jakarta Sans", sans-serif';
  const tickLabels = ticks.map(v => Math.round(v).toLocaleString('id-ID'));
  const maxLabelWidth = tickLabels.reduce((w, s) => Math.max(w, measureCtx.measureText(s).width), 0);

  const padLeft = Math.ceil(maxLabelWidth) + 18, padTop = 12, padBottom = 22;
  const groupWidth = 64; // px per bulan, TETAP -> bar mulai dari kiri, gak ke-stretch pas bulan dikit
  const barsAreaW = data.length * groupWidth;

  const scrollWrap = canvas.parentElement; // .chart-scroll
  const containerWidth = scrollWrap.clientWidth;
  const cssWidth = Math.max(containerWidth, padLeft + barsAreaW + 8);
  const cssHeight = 180;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  canvas.style.width = cssWidth + 'px';
  canvas.style.height = cssHeight + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const chartH = cssHeight - padBottom - padTop;
  const gridEndX = padLeft + barsAreaW;

  // Grid line + label nominal di kiri (mis. 500.000 / 250.000 / 100.000)
  ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ticks.forEach(v => {
    const y = padTop + chartH - (v / niceMax) * chartH;
    ctx.beginPath();
    ctx.moveTo(padLeft, Math.round(y) + 0.5);
    ctx.lineTo(gridEndX, Math.round(y) + 0.5);
    ctx.stroke();
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(v).toLocaleString('id-ID'), padLeft - 8, y);
  });

  // baseline
  ctx.beginPath();
  ctx.moveTo(padLeft, padTop + chartH + 0.5);
  ctx.lineTo(gridEndX, padTop + chartH + 0.5);
  ctx.stroke();

  ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const barW = Math.max(8, Math.min(18, groupWidth * 0.26));
  const gap = 5;

  data.forEach((d, i) => {
    const cx = padLeft + groupWidth * i + groupWidth / 2;
    const incomeH = (d.income / niceMax) * chartH;
    const expenseH = (d.expense / niceMax) * chartH;

    ctx.fillStyle = incomeColor;
    roundRectPath(ctx, cx - barW - gap/2, padTop + chartH - incomeH, barW, incomeH, 4);
    ctx.fill();

    ctx.fillStyle = expenseColor;
    roundRectPath(ctx, cx + gap/2, padTop + chartH - expenseH, barW, expenseH, 4);
    ctx.fill();

    ctx.fillStyle = textColor;
    const [y, mo] = d.month.split('-');
    const label = new Date(y, mo - 1, 1).toLocaleDateString('id-ID', {month:'short'});
    ctx.fillText(label, cx, cssHeight - 6);
  });
}
window.addEventListener('resize', () => { if(document.getElementById('trendChart')) renderChart(); });

// ============================= //
// Chart card: expand/collapse + simpan state ke localStorage
// ============================= //
function applyChartCollapse(collapsed){
  const card = document.getElementById('chartCard');
  if(!card) return;
  card.classList.toggle('collapsed', collapsed);
  if(!collapsed) renderChart();
}
function toggleChartCollapse(){
  const collapsed = !document.getElementById('chartCard').classList.contains('collapsed');
  localStorage.setItem(CHART_COLLAPSE_KEY, collapsed ? '1' : '0');
  applyChartCollapse(collapsed);
}

function escapeHtml(s){
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ============================= //
// Dark mode: toggle + simpan ke localStorage (cache)
// ============================= //
function applyTheme(theme){
  document.body.setAttribute('data-theme', theme);
  const icon = document.getElementById('darkModeIcon');
  const state = document.getElementById('darkModeState');
  if(theme === 'dark'){
    icon.className = 'fa-solid fa-sun';
    state.textContent = 'On';
  } else {
    icon.className = 'fa-solid fa-moon';
    state.textContent = 'Off';
  }
  if(document.getElementById('trendChart') && typeof txns !== 'undefined' && txns) renderChart();
}
function toggleDarkMode(){
  const current = document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}
(function initTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'dark' ? 'dark' : 'light');
})();

// ============================= //
// Block zoom (pinch, double-tap, gesture) & copy popup
// ============================= //
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('selectstart', e => e.preventDefault());
document.addEventListener('dragstart', e => e.preventDefault());
document.addEventListener('touchstart', e => {
  if (e.touches.length > 1) e.preventDefault(); // cegah pinch-zoom
}, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', e => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) e.preventDefault(); // cegah double-tap zoom
  lastTouchEnd = now;
}, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());
document.addEventListener('gestureend', e => e.preventDefault());

// ============================= //
// Sistem Akun: buat akun / login pakai ID, sync data ke server (Vercel Blob)
// Catatan: nama + ID cuma pengecekan dasar, BUKAN password sungguhan —
// siapa pun yang tau nama & ID akun bisa login. Jangan sebar ID ke orang lain.
// ============================= //
const ACCOUNT_KEY = 'account_v1';
let account = null; // { uid, name }
let syncTimer = null;

function loadAccount(){
  try{
    const raw = localStorage.getItem(ACCOUNT_KEY);
    account = raw ? JSON.parse(raw) : null;
  }catch(e){ account = null; }
}
function saveAccountSession(acc){
  account = acc;
  if(acc) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acc));
  else localStorage.removeItem(ACCOUNT_KEY);
  updateAccountUI();
}
function updateAccountUI(){
  const state = document.getElementById('accountMenuState');
  const loggedOut = document.getElementById('accountLoggedOut');
  const loggedIn = document.getElementById('accountLoggedIn');
  if(account){
    if(state) state.textContent = account.name;
    if(loggedOut) loggedOut.style.display = 'none';
    if(loggedIn) loggedIn.style.display = 'block';
    document.getElementById('accountNameDisplay').textContent = account.name;
    const uidEl = document.getElementById('accountUidDisplay');
    uidEl.dataset.uid = account.uid;
    uidEl.classList.remove('revealed');
    uidEl.textContent = '•'.repeat(account.uid.length);
    applyAvatarColor();
  } else {
    if(state) state.textContent = 'Belum Login';
    if(loggedOut) loggedOut.style.display = 'block';
    if(loggedIn) loggedIn.style.display = 'none';
  }
}

// ============================= //
// Warna profil (palet warna primer, bukan custom color/foto)
// ============================= //
const AVATAR_COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#06b6d4', '#a855f7', '#f97316', '#ec4899', '#eab308', '#14b8a6', '#64748b'];

function avatarColorKey(){
  return 'avatar_color_' + (account ? account.uid : 'guest');
}
function loadAvatarColor(){
  return localStorage.getItem(avatarColorKey()) || AVATAR_COLORS[0];
}
function applyAvatarColor(){
  const dot = document.getElementById('accountAvatarDot');
  if(dot) dot.style.background = loadAvatarColor();
}
function openAvatarColorPicker(){
  const grid = document.getElementById('avatarColorGrid');
  const current = loadAvatarColor();
  grid.innerHTML = AVATAR_COLORS.map(c =>
    '<button type="button" onclick="chooseAvatarColor(\'' + c + '\')" style="width:36px; height:36px; border-radius:50%; background:' + c + '; border:3px solid ' + (c === current ? 'var(--text)' : 'transparent') + '; cursor:pointer; padding:0;"></button>'
  ).join('');
  document.getElementById('avatarColorOverlay').classList.add('open');
}
function closeAvatarColorPicker(){
  document.getElementById('avatarColorOverlay').classList.remove('open');
}
document.getElementById('avatarColorOverlay').addEventListener('click', (e) => {
  if(e.target.id === 'avatarColorOverlay') closeAvatarColorPicker();
});
function chooseAvatarColor(color){
  localStorage.setItem(avatarColorKey(), color);
  applyAvatarColor();
  closeAvatarColorPicker();
}

function openAccountSheet(){
  document.getElementById('accountFormError').style.display = 'none';
  setAuthTab('create');
  const uidEl = document.getElementById('accountUidDisplay');
  uidEl.classList.remove('revealed');
  if(uidEl.dataset.uid) uidEl.textContent = '•'.repeat(uidEl.dataset.uid.length);
  document.getElementById('accountOverlay').classList.add('open');
}
function closeAccountSheet(){
  document.getElementById('accountOverlay').classList.remove('open');
}
function setAuthTab(tab){
  document.getElementById('authTabCreate').classList.toggle('active', tab === 'create');
  document.getElementById('authTabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('createAccountForm').style.display = tab === 'create' ? 'block' : 'none';
  document.getElementById('loginAccountForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('accountFormError').style.display = 'none';
}
function showAccountError(msg){
  const el = document.getElementById('accountFormError');
  el.textContent = msg;
  el.style.display = 'block';
}

async function submitCreateAccount(e){
  e.preventDefault();
  const name = document.getElementById('createName').value.trim();
  if(!name) return;
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Membuat...';
  try{
    const res = await fetch('/api/account/create', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Gagal membuat akun');
    saveAccountSession({ uid: data.uid, name: data.name });
    syncToServer(true);
    document.getElementById('createAccountForm').reset();
  }catch(err){
    showAccountError(err.message);
  }finally{
    btn.disabled = false; btn.textContent = 'Buat Akun';
  }
}

async function submitLoginAccount(e){
  e.preventDefault();
  const name = document.getElementById('loginName').value.trim();
  const uid = document.getElementById('loginUid').value.trim();
  if(!name || !uid) return;
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Masuk...';
  try{
    // Simpen dulu kegiatan yang udah kecatet di HP ini (sebagai guest/belum login),
    // sebelum ketimpa data yang ditarik dari akun tujuan
    const localTxns = Array.isArray(txns) ? txns.slice() : [];
    const localGoal = savingsGoal;

    const res = await fetch('/api/account/login', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ name, uid })
    });
    const data = await res.json();
    if(!res.ok){
      if(data.code === 'SESSION_ACTIVE'){
        openSessionWarning();
        return;
      }
      throw new Error(data.error || 'Gagal login');
    }
    saveAccountSession({ uid: data.uid, name: data.name });

    const serverTxns = Array.isArray(data.txns) ? data.txns : [];
    const serverGoal = typeof data.goal === 'number' ? data.goal : 0;

    // Gabungkan kegiatan lokal (yang tadinya cuma di localStorage) ke data akun,
    // biar gak hilang begitu login ke akun yang sudah ada — dedupe pakai id
    const existingIds = new Set(serverTxns.map(t => t.id));
    const mergedTxns = serverTxns.slice();
    let hasLocalOnlyData = false;
    localTxns.forEach(t => {
      if(!existingIds.has(t.id)){
        mergedTxns.push(t);
        existingIds.add(t.id);
        hasLocalOnlyData = true;
      }
    });
    const mergedGoal = serverGoal > 0 ? serverGoal : localGoal;
    if(mergedGoal !== serverGoal) hasLocalOnlyData = true;

    txns = mergedTxns;
    savingsGoal = mergedGoal;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(txns));
    localStorage.setItem(GOAL_KEY, String(savingsGoal));

    // Kalau ada kegiatan lokal yang belum pernah nyampe server, langsung push
    // supaya dari sini penyimpanan aslinya lewat ID/akun, localStorage cuma cache
    if(hasLocalOnlyData) await syncToServer(true);

    populateMonths();
    render();
    closeAccountSheet();
  }catch(err){
    showAccountError(err.message);
  }finally{
    btn.disabled = false; btn.textContent = 'Masuk';
  }
}

function openLogoutConfirm(){
  document.getElementById('logoutConfirmOverlay').classList.add('open');
}
function closeLogoutConfirm(){
  document.getElementById('logoutConfirmOverlay').classList.remove('open');
}
document.getElementById('logoutConfirmOverlay').addEventListener('click', (e) => {
  if(e.target.id === 'logoutConfirmOverlay') closeLogoutConfirm();
});
function confirmLogoutAccount(){
  const acc = account;
  saveAccountSession(null);
  closeLogoutConfirm();
  closeAccountSheet();

  // Bersihin cache lokal punya akun ini biar gak nyangkut jadi "data guest"
  // di device (penting buat device bersama: kalau gak dibersihin, login/daftar
  // akun lain di device yang sama bisa ke-merge sama sisa data akun lama).
  txns = [];
  savingsGoal = 0;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(txns));
  localStorage.setItem(GOAL_KEY, String(savingsGoal));
  populateMonths();
  render();

  if(acc){
    fetch('/api/account/logout', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ name: acc.name, uid: acc.uid })
    }).catch(err => console.error('Logout server gagal:', err));
  }
}

function openSessionWarning(){
  document.getElementById('sessionWarningOverlay').classList.add('open');
}
function closeSessionWarning(){
  document.getElementById('sessionWarningOverlay').classList.remove('open');
}
document.getElementById('sessionWarningOverlay').addEventListener('click', (e) => {
  if(e.target.id === 'sessionWarningOverlay') closeSessionWarning();
});

function openDeleteConfirm(){
  if(!account) return;
  document.getElementById('deleteConfirmName').textContent = account.name;
  document.getElementById('deleteConfirmUid').textContent = account.uid;
  document.getElementById('deleteConfirmError').style.display = 'none';
  document.getElementById('deleteConfirmOverlay').classList.add('open');
}
function closeDeleteConfirm(){
  document.getElementById('deleteConfirmOverlay').classList.remove('open');
}
document.getElementById('deleteConfirmOverlay').addEventListener('click', (e) => {
  if(e.target.id === 'deleteConfirmOverlay') closeDeleteConfirm();
});

async function confirmDeleteAccount(){
  if(!account) return;
  const btn = document.getElementById('deleteConfirmBtn');
  const errEl = document.getElementById('deleteConfirmError');
  errEl.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Menghapus...';
  try{
    const res = await fetch('/api/account/delete', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ name: account.name, uid: account.uid })
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Gagal menghapus akun');

    txns = [];
    savingsGoal = 0;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(txns));
    localStorage.setItem(GOAL_KEY, String(savingsGoal));
    saveAccountSession(null);
    populateMonths();
    render();
    closeDeleteConfirm();
    closeAccountSheet();
  }catch(err){
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }finally{
    btn.disabled = false; btn.textContent = 'Hapus';
  }
}

function copyAccountUid(){
  if(!account) return;
  navigator.clipboard?.writeText(account.uid);
}

function toggleUidSpoiler(el){
  const revealed = el.classList.toggle('revealed');
  el.textContent = revealed ? el.dataset.uid : '•'.repeat(el.dataset.uid.length);
}

function syncToServer(immediate){
  if(!account) return Promise.resolve();
  clearTimeout(syncTimer);
  return new Promise((resolve) => {
    const run = async () => {
      try{
        await fetch('/api/account/sync', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ uid: account.uid, name: account.name, txns, goal: savingsGoal })
        });
      }catch(e){ console.error('Sync gagal:', e); }
      resolve();
    };
    if(immediate){ run(); } else { syncTimer = setTimeout(run, 600); }
  });
}

loadAccount();
load();
loadGoal();
populateMonths();
render();
applyChartCollapse(localStorage.getItem(CHART_COLLAPSE_KEY) === '1');
updateAccountUI();

// Kalau lagi login, tarik data terbaru dari server (biar sinkron antar device
// & tetap aman meski localStorage di HP ini kehapus)
if(account){
  fetch('/api/account/refresh', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ name: account.name, uid: account.uid })
  })
  .then(r => r.ok ? r.json() : null)
  .then(data => {
    if(!data) return;
    txns = Array.isArray(data.txns) ? data.txns : [];
    savingsGoal = typeof data.goal === 'number' ? data.goal : 0;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(txns));
    localStorage.setItem(GOAL_KEY, String(savingsGoal));
    populateMonths();
    render();
  })
  .catch(err => console.error('Auto-sync gagal:', err));
}

// ============================= //
// Popup pesan info/pembaruan dari msg.json
// ============================= //
function closeMsgPopup(){
  document.getElementById('msgOverlay').classList.remove('open');
}
document.getElementById('msgOverlay').addEventListener('click', (e) => {
  if(e.target.id === 'msgOverlay') closeMsgPopup();
});

fetch('msg.json', { cache: 'no-store' })
  .then(r => r.ok ? r.json() : null)
  .then(data => {
    if(!data) return;
    const shouldShow = data.status === true || data.status === 'true';
    if(!shouldShow) return;
    if(!data.message) return;
    document.getElementById('msgBoxText').textContent = data.message;
    document.getElementById('msgOverlay').classList.add('open');
  })
  .catch(err => console.error('Gagal ambil msg.json:', err));

// ============================= //
// PWA: service worker + custom install banner
// ============================= //
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.error('SW register failed:', err));
  });
}

// ============================= //
// Install PWA — cuma lewat menu "Download App", gak ada notif otomatis.
// Event beforeinstallprompt tetep ditangkap diam-diam biar siap dipakai
// begitu user pencet menu-nya.
// ============================= //
let deferredInstallPrompt = null;

const PWA_INSTALLED_KEY = 'pwa_installed_v2';

function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// isStandalone() cuma true kalau app-nya lagi dibuka DARI ikon yang keinstall.
// Kalau user buka dari tab browser biasa (padahal udah pernah install sebelumnya),
// isStandalone() bakal false terus — makanya dikombinasi sama flag yang disimpen
// pas event 'appinstalled' kejadian, biar tetep kedeteksi "udah terinstall".
function isInstalled(){
  return isStandalone() || localStorage.getItem(PWA_INSTALLED_KEY) === '1';
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  localStorage.setItem(PWA_INSTALLED_KEY, '1');
});

function openInstallHelp(){
  const textEl = document.getElementById('installHelpText');
  const btnRow = document.getElementById('installHelpButtons');

  if (isInstalled()){
    textEl.innerHTML = 'Tabungaja sudah ada di perangkat kamu.';
    btnRow.innerHTML = '<button type="button" class="reset-confirm-btn" style="flex:1; background:var(--text); color:var(--bg);" onclick="closeInstallHelp()">Oke</button>';
  } else {
    textEl.innerHTML = 'Install sekarang untuk akses yang lebih cepat.';
    btnRow.innerHTML =
      '<button type="button" class="reset-confirm-btn" style="flex:1; background:var(--surface); color:var(--text); border:1px solid var(--border);" onclick="closeInstallHelp()">Batal</button>' +
      '<button type="button" class="reset-confirm-btn" style="flex:1; background:var(--income);" onclick="confirmInstall()">Install</button>';
  }

  document.getElementById('installHelpOverlay').classList.add('open');
}
function closeInstallHelp(){
  document.getElementById('installHelpOverlay').classList.remove('open');
}
document.getElementById('installHelpOverlay').addEventListener('click', (e) => {
  if(e.target.id === 'installHelpOverlay') closeInstallHelp();
});

async function confirmInstall(){
  if (!deferredInstallPrompt) { closeInstallHelp(); return; }
  closeInstallHelp();
  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  if (choice.outcome === 'accepted') localStorage.setItem(PWA_INSTALLED_KEY, '1');
  deferredInstallPrompt = null;
}
