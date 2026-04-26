/* ================================================================
   Smart Expense Tracker – script.js
   Supabase-backed, modular, bulletproof event handling.
   ================================================================ */

// ---------- Supabase Config ----------
const SUPABASE_URL = 'https://cyonbxdhebqwktigfexp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z9LXbdsEY1EvMaZZmxA9_g_KnEXflAn';

let sb; // Supabase client – initialised safely below
try {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
    console.error('Supabase init failed:', e);
}

// ---------- Category colours ----------
const CAT_COLORS = {
    Food:          '#ef4444',
    Transport:     '#3b82f6',
    Bills:         '#f59e0b',
    Entertainment: '#8b5cf6',
    Health:        '#10b981',
    Other:         '#64748b'
};

// ---------- State ----------
let expenses = [];
let budget   = 1000;

// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

function toast(msg, type = 'success') {
    const box = $('#toastBox');
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation';
    el.innerHTML = `<i class="fa-solid ${icon}"></i><span>${msg}</span>`;
    box.appendChild(el);
    setTimeout(() => { el.classList.add('removing'); setTimeout(() => el.remove(), 300); }, 3000);
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// ---------- Data layer ----------
async function fetchExpenses() {
    if (!sb) return;
    try {
        const { data, error } = await sb.from('expenses').select('*').order('date', { ascending: false });
        if (error) throw error;
        expenses = data || [];
    } catch (e) {
        console.error('Fetch expenses error:', e);
        toast('Could not load expenses from Supabase.', 'error');
    }
}

async function fetchBudget() {
    if (!sb) return;
    try {
        const { data } = await sb.from('settings').select('*').eq('key', 'budget').single();
        if (data) budget = data.value.monthly;
    } catch (_) { /* keep default */ }
}

async function saveBudget(val) {
    budget = parseFloat(val);
    if (!sb) return;
    await sb.from('settings').upsert({ key: 'budget', value: { monthly: budget }, updated_at: new Date().toISOString() });
}

async function addExpense(exp) {
    if (!sb) { toast('Supabase not connected.', 'error'); return false; }
    try {
        const { data, error } = await sb.from('expenses').insert([exp]).select();
        if (error) throw error;
        expenses.unshift(data[0]);
        expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
        return true;
    } catch (e) { console.error(e); return false; }
}

async function deleteExpense(id) {
    if (!sb) return false;
    try {
        const { error } = await sb.from('expenses').delete().eq('id', id);
        if (error) throw error;
        expenses = expenses.filter(e => e.id !== id);
        return true;
    } catch (e) { console.error(e); return false; }
}

async function clearAllExpenses() {
    if (!sb) return false;
    try {
        const { error } = await sb.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
        expenses = [];
        return true;
    } catch (e) { console.error(e); return false; }
}

// ---------- Analytics helpers ----------
function getSummary() {
    const total = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
    const now = new Date();
    const monthly = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((s, e) => s + parseFloat(e.amount), 0);
    return { total, monthly };
}

function getCategoryData() {
    const m = {};
    expenses.forEach(e => m[e.category] = (m[e.category] || 0) + parseFloat(e.amount));
    return m;
}

function getMonthlyTrends() {
    const m = {};
    expenses.forEach(e => { const k = e.date.substring(0, 7); m[k] = (m[k] || 0) + parseFloat(e.amount); });
    const keys = Object.keys(m).sort();
    return { labels: keys, values: keys.map(k => m[k]) };
}

// ---------- Charts ----------
let chartPie, chartBar, chartLine;

function renderCharts() {
    const catData = getCategoryData();
    const catLabels = Object.keys(catData);
    const catValues = Object.values(catData);
    const catColors = catLabels.map(l => CAT_COLORS[l] || '#ccc');
    const trends = getMonthlyTrends();

    const textColor = getComputedStyle(document.body).getPropertyValue('--text2').trim();
    const gridColor = getComputedStyle(document.body).getPropertyValue('--border').trim();
    Chart.defaults.color = textColor;
    Chart.defaults.font.family = "'Outfit',sans-serif";

    if (chartPie) chartPie.destroy();
    if (chartBar) chartBar.destroy();
    if (chartLine) chartLine.destroy();

    chartPie = new Chart($('#chartPie'), {
        type: 'doughnut',
        data: { labels: catLabels, datasets: [{ data: catValues, backgroundColor: catColors, borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right' } } }
    });

    chartBar = new Chart($('#chartBar'), {
        type: 'bar',
        data: { labels: trends.labels, datasets: [{ label: 'Expenses', data: trends.values, backgroundColor: 'rgba(79,70,229,.75)', borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: gridColor } }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } }
    });

    chartLine = new Chart($('#chartLine'), {
        type: 'line',
        data: { labels: trends.labels, datasets: [{ label: 'Total', data: trends.values, borderColor: '#4f46e5', backgroundColor: 'rgba(79,70,229,.1)', borderWidth: 3, fill: true, tension: .4 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: gridColor } }, x: { grid: { color: gridColor } } } }
    });
}

// ---------- Render UI ----------
function badge(cat) {
    const c = CAT_COLORS[cat] || CAT_COLORS.Other;
    return `<span class="badge" style="background:${c}18;color:${c};border:1px solid ${c}40">${cat}</span>`;
}

function renderDashboard() {
    const { total, monthly } = getSummary();
    $('#valTotalExpenses').textContent = fmt(total);
    $('#valMonthlyExpenses').textContent = fmt(monthly);
    $('#valBudget').textContent = fmt(budget);

    const pct = Math.min((monthly / budget) * 100, 100);
    const bar = $('#budgetBarFill');
    bar.style.width = pct + '%';
    const warn = $('#budgetWarning');
    if (pct >= 100) { bar.style.background = 'var(--danger)'; warn.textContent = '⚠ Budget exceeded!'; }
    else if (pct >= 80) { bar.style.background = 'var(--warning)'; warn.textContent = '⚠ Nearing limit!'; }
    else { bar.style.background = 'var(--success)'; warn.textContent = ''; }
}

function renderRecentTable() {
    const tbody = $('#tableRecent tbody');
    const empty = $('#emptyRecent');
    tbody.innerHTML = '';
    if (!expenses.length) { empty.style.display = 'block'; $('#tableRecent').style.display = 'none'; return; }
    empty.style.display = 'none'; $('#tableRecent').style.display = '';
    expenses.slice(0, 5).forEach(e => {
        tbody.insertAdjacentHTML('beforeend', `<tr>
            <td>${new Date(e.date).toLocaleDateString()}</td>
            <td style="font-weight:500">${e.description}</td>
            <td>${badge(e.category)}</td>
            <td style="font-weight:700">${fmt(e.amount)}</td></tr>`);
    });
}

function renderAllTable() {
    const search = ($('#filterSearch').value || '').toLowerCase();
    const cat = $('#filterCategory').value;
    const month = $('#filterMonth').value;

    const filtered = expenses.filter(e => {
        if (search && !e.description.toLowerCase().includes(search)) return false;
        if (cat !== 'All' && e.category !== cat) return false;
        if (month && e.date.substring(0, 7) !== month) return false;
        return true;
    });

    const tbody = $('#tableAll tbody');
    const empty = $('#emptyAll');
    tbody.innerHTML = '';
    if (!filtered.length) { empty.style.display = 'block'; $('#tableAll').style.display = 'none'; return; }
    empty.style.display = 'none'; $('#tableAll').style.display = '';

    filtered.forEach(e => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(e.date).toLocaleDateString()}</td>
            <td style="font-weight:500">${e.description}</td>
            <td>${badge(e.category)}</td>
            <td style="font-weight:700">${fmt(e.amount)}</td>
            <td><button class="btn-icon js-delete" data-id="${e.id}" style="width:30px;height:30px;color:var(--danger);border-color:var(--danger)"><i class="fa-solid fa-trash-can"></i></button></td>`;
        tbody.appendChild(tr);
    });

    $$('.js-delete').forEach(btn => {
        btn.onclick = async () => {
            if (!confirm('Delete this expense?')) return;
            if (await deleteExpense(btn.dataset.id)) { toast('Deleted!'); renderAll(); } else toast('Delete failed.', 'error');
        };
    });
}

function renderInsights() {
    const list = $('#insightsList');
    if (!expenses.length) { list.innerHTML = '<li><i class="fa-solid fa-circle-info"></i> Add some expenses to see insights.</li>'; return; }
    const catData = getCategoryData();
    let topCat = '', topVal = 0;
    for (const [k, v] of Object.entries(catData)) if (v > topVal) { topVal = v; topCat = k; }
    const { monthly } = getSummary();
    const pct = ((monthly / budget) * 100).toFixed(1);
    list.innerHTML = `
        <li><i class="fa-solid fa-fire"></i> Top category: <strong>${topCat}</strong> — ${fmt(topVal)}</li>
        <li><i class="fa-solid fa-chart-simple"></i> Budget used this month: <strong>${pct}%</strong></li>
        <li><i class="fa-solid fa-receipt"></i> Total transactions: <strong>${expenses.length}</strong></li>`;
}

function renderAll() {
    renderDashboard();
    renderRecentTable();
    renderAllTable();
    renderCharts();
    renderInsights();
}

// ---------- Page Navigation ----------
function showPage(name) {
    $$('.page').forEach(p => p.classList.remove('active'));
    $(`#page${name.charAt(0).toUpperCase() + name.slice(1)}`).classList.add('active');
    $$('.nav-links li').forEach(li => li.classList.toggle('active', li.dataset.page === name));
    const titles = { dashboard: 'Dashboard', transactions: 'Transactions', analytics: 'Analytics' };
    $('#pageTitle').textContent = titles[name] || 'Dashboard';
}

// ---------- Boot ----------
document.addEventListener('DOMContentLoaded', () => {
    // Set date subtitle
    $('#dateSubtitle').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') document.body.classList.add('dark');
    updateThemeIcon();

    // ---- Wire up ALL event listeners FIRST, before any async ----

    // Nav
    $$('.nav-links li').forEach(li => li.addEventListener('click', () => showPage(li.dataset.page)));

    // View All
    $('#btnViewAll').addEventListener('click', () => showPage('transactions'));

    // Add Expense button → open modal
    $('#btnAddExpense').addEventListener('click', () => {
        $('#formExpense').reset();
        $('#inputDate').valueAsDate = new Date();
        $('#modalExpenseTitle').textContent = 'Add Expense';
        openModal('modalExpense');
    });

    // Settings button → open modal
    $('#btnSettings').addEventListener('click', () => {
        $('#inputBudget').value = budget;
        openModal('modalSettings');
    });

    // Close modal buttons
    $$('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });

    // Click outside modal to close
    $$('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) backdrop.style.display = 'none';
        });
    });

    // Theme toggle
    $('#btnThemeToggle').addEventListener('click', () => {
        document.body.classList.toggle('dark');
        const isDark = document.body.classList.contains('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateThemeIcon();
        renderCharts();
    });

    // Filters
    $('#filterSearch').addEventListener('input', renderAllTable);
    $('#filterCategory').addEventListener('change', renderAllTable);
    $('#filterMonth').addEventListener('change', renderAllTable);

    // Export CSV
    $('#btnExportCsv').addEventListener('click', () => {
        if (!expenses.length) { toast('Nothing to export.', 'error'); return; }
        const rows = [['Date', 'Description', 'Category', 'Amount'].join(',')];
        expenses.forEach(e => rows.push([e.date, `"${e.description}"`, e.category, e.amount].join(',')));
        const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        toast('CSV exported!');
    });

    // Clear All
    $('#btnClearAll').addEventListener('click', async () => {
        if (!confirm('Delete ALL expenses? This cannot be undone.')) return;
        if (await clearAllExpenses()) { toast('All data cleared.'); renderAll(); } else toast('Clear failed.', 'error');
    });

    // Expense form submit
    $('#formExpense').addEventListener('submit', async (e) => {
        e.preventDefault();
        const exp = {
            amount: parseFloat($('#inputAmount').value),
            description: $('#inputDescription').value.trim(),
            category: $('#inputCategory').value,
            date: $('#inputDate').value
        };
        if (!exp.description || !exp.category || !exp.date) { toast('Fill all fields.', 'error'); return; }
        const ok = await addExpense(exp);
        if (ok) { toast('Expense added!'); closeModal('modalExpense'); renderAll(); }
        else toast('Failed to save. Check Supabase.', 'error');
    });

    // Settings form submit
    $('#formSettings').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveBudget($('#inputBudget').value);
        toast('Budget updated!');
        closeModal('modalSettings');
        renderAll();
    });

    // ---- Now load data asynchronously ----
    renderAll(); // show empty state immediately

    (async () => {
        await fetchBudget();
        await fetchExpenses();
        renderAll(); // re-render with real data
    })();
});

function updateThemeIcon() {
    const icon = $('#themeIcon');
    if (document.body.classList.contains('dark')) {
        icon.className = 'fa-solid fa-sun';
    } else {
        icon.className = 'fa-solid fa-moon';
    }
}
