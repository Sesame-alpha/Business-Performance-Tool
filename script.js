// ---------- GLOBALS ----------
let fullData = [];
let filteredData = [];
let charts = { line: null, bar: null, pie: null };

// DOM elements
const datePicker = document.getElementById('dateRangePicker');
const deptContainer = document.getElementById('deptCheckboxes');
const regionContainer = document.getElementById('regionCheckboxes');
const resetBtn = document.getElementById('resetAllBtn');
const searchInput = document.getElementById('tableSearch');
const exportBtn = document.getElementById('exportCsvBtn');
const darkToggle = document.getElementById('darkModeToggle');

// Helper: format Pula
function formatPula(amount) {
    return 'P ' + amount.toLocaleString();
}

// ---------- URL STATE ----------
function updateURL() {
    const params = new URLSearchParams();
    if (datePicker.value) params.set('range', datePicker.value);
    const selectedDepts = Array.from(document.querySelectorAll('#deptCheckboxes input:checked')).map(cb => cb.value);
    if (selectedDepts.length) params.set('depts', selectedDepts.join(','));
    const selectedRegions = Array.from(document.querySelectorAll('#regionCheckboxes input:checked')).map(cb => cb.value);
    if (selectedRegions.length) params.set('regions', selectedRegions.join(','));
    if (searchInput.value) params.set('search', searchInput.value);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);
}

function loadStateFromURL() {
    const params = new URLSearchParams(window.location.search);
    const deptStr = params.get('depts');
    const regionStr = params.get('regions');
    return {
        depts: deptStr ? deptStr.split(',') : [],
        regions: regionStr ? regionStr.split(',') : [],
        search: params.get('search') || '',
        range: params.get('range') || ''
    };
}

// ---------- FILTER DATA ----------
function applyAllFilters() {
    let data = [...fullData];
    // date range filter
    if (datePicker.value) {
        const [start, end] = datePicker.value.split(' to ');
        if (start && end) {
            data = data.filter(rec => rec.date >= start && rec.date <= end);
        }
    }
    // department multi
    const selectedDepts = Array.from(document.querySelectorAll('#deptCheckboxes input:checked')).map(cb => cb.value);
    if (selectedDepts.length) {
        data = data.filter(rec => selectedDepts.includes(rec.department));
    }
    // region multi
    const selectedRegions = Array.from(document.querySelectorAll('#regionCheckboxes input:checked')).map(cb => cb.value);
    if (selectedRegions.length) {
        data = data.filter(rec => selectedRegions.includes(rec.region));
    }
    // search
    const searchTerm = searchInput.value.toLowerCase();
    if (searchTerm) {
        data = data.filter(rec =>
            rec.date.includes(searchTerm) ||
            rec.department.toLowerCase().includes(searchTerm) ||
            rec.region.toLowerCase().includes(searchTerm) ||
            rec.revenue.toString().includes(searchTerm) ||
            rec.expenses.toString().includes(searchTerm)
        );
    }
    filteredData = data;
    updateKPIs();
    renderCharts();
    renderTable();
    updateURL();
}

// ---------- KPIs ----------
function updateKPIs() {
    let rev = 0, exp = 0, target = 0;
    filteredData.forEach(r => { rev += r.revenue; exp += r.expenses; target += r.targetRevenue; });
    const profit = rev - exp;
    document.getElementById('totalRevenue').innerText = formatPula(rev);
    document.getElementById('totalExpenses').innerText = formatPula(exp);
    document.getElementById('totalProfit').innerText = formatPula(profit);
    const margin = rev ? (profit / rev * 100).toFixed(1) : 0;
    document.getElementById('profitMargin').innerHTML = `margin: ${margin}%`;
    const vsTarget = target ? (rev / target * 100) : 0;
    document.getElementById('revenueVsTarget').innerText = vsTarget.toFixed(1) + '%';
    document.getElementById('targetProgress').style.width = Math.min(vsTarget, 100) + '%';
}

// ---------- CHARTS with drill-down ----------
function renderCharts() {
    if (charts.line) charts.line.destroy();
    if (charts.bar) charts.bar.destroy();
    if (charts.pie) charts.pie.destroy();

    // Line (monthly revenue)
    const monthly = {};
    filteredData.forEach(r => { monthly[r.date] = (monthly[r.date] || 0) + r.revenue; });
    const months = Object.keys(monthly).sort();
    const revenues = months.map(m => monthly[m]);
    const ctxLine = document.getElementById('revenueLineChart').getContext('2d');
    charts.line = new Chart(ctxLine, {
        type: 'line',
        data: { labels: months.map(m => m.slice(5) + '/' + m.slice(2,4)), datasets: [{ label: 'Revenue', data: revenues, borderColor: '#2c7da0', tension: 0.3 }] }
    });

    // Bar (expenses by dept) with drill-down
    const deptExp = {};
    filteredData.forEach(r => { deptExp[r.department] = (deptExp[r.department] || 0) + r.expenses; });
    const depts = Object.keys(deptExp);
    const ctxBar = document.getElementById('expensesBarChart').getContext('2d');
    charts.bar = new Chart(ctxBar, {
        type: 'bar',
        data: { labels: depts, datasets: [{ label: 'Expenses', data: depts.map(d => deptExp[d]), backgroundColor: '#e76f51' }] },
        options: { onClick: (e, active) => { if (active.length) { const dept = depts[active[0].index]; filterByDepartment(dept); } } }
    });

    // Pie (revenue share) with drill-down
    const deptRev = {};
    filteredData.forEach(r => { deptRev[r.department] = (deptRev[r.department] || 0) + r.revenue; });
    const ctxPie = document.getElementById('revenuePieChart').getContext('2d');
    charts.pie = new Chart(ctxPie, {
        type: 'pie',
        data: { labels: Object.keys(deptRev), datasets: [{ data: Object.values(deptRev), backgroundColor: ['#2a9d8f','#e9c46a','#f4a261','#e76f51'] }] },
        options: { onClick: (e, active) => { if (active.length) { const dept = Object.keys(deptRev)[active[0].index]; filterByDepartment(dept); } } }
    });
}

function filterByDepartment(dept) {
    document.querySelectorAll('#deptCheckboxes input').forEach(cb => cb.checked = false);
    const targetCb = document.querySelector(`#deptCheckboxes input[value="${dept}"]`);
    if (targetCb) targetCb.checked = true;
    applyAllFilters();
}

// ---------- TABLE RENDER ----------
function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!filteredData.length) { tbody.innerHTML = '<tr><td colspan="7">No data</td></tr>'; return; }
    tbody.innerHTML = filteredData.map(r => `
        <tr>
            <td>${r.date}</td><td>${r.department}</td><td>${r.region}</td>
            <td>${formatPula(r.revenue)}</td><td>${formatPula(r.expenses)}</td>
            <td class="${r.revenue - r.expenses >= 0 ? 'text-success' : 'text-danger'}">${formatPula(r.revenue - r.expenses)}</td>
            <td>${formatPula(r.targetRevenue)}</td>
        </tr>
    `).join('');
}

// ---------- EXPORT CSV ----------
function exportCSV() {
    const headers = ['Date','Department','Region','Revenue','Expenses','Profit','TargetRevenue'];
    const rows = filteredData.map(r => [r.date, r.department, r.region, r.revenue, r.expenses, r.revenue - r.expenses, r.targetRevenue]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], {type: 'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dashboard_export_${new Date().toISOString().slice(0,19)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
}

// ---------- DARK MODE ----------
function initDarkMode() {
    const saved = localStorage.getItem('darkMode');
    if (saved === 'true') document.body.classList.add('dark');
    darkToggle.onclick = () => {
        document.body.classList.toggle('dark');
        localStorage.setItem('darkMode', document.body.classList.contains('dark'));
    };
}

// ---------- POPULATE CHECKBOXES ----------
function populateCheckboxes() {
    const allDepts = [...new Set(fullData.map(d => d.department))].sort();
    deptContainer.innerHTML = allDepts.map(d => `<div class="form-check"><input class="form-check-input" type="checkbox" value="${d}" id="dept_${d}"><label class="form-check-label" for="dept_${d}">${d}</label></div>`).join('');
    const allRegions = [...new Set(fullData.map(d => d.region))].sort();
    regionContainer.innerHTML = allRegions.map(r => `<div class="form-check"><input class="form-check-input" type="checkbox" value="${r}" id="region_${r}"><label class="form-check-label" for="region_${r}">${r}</label></div>`).join('');
    document.querySelectorAll('#deptCheckboxes input, #regionCheckboxes input').forEach(cb => cb.addEventListener('change', applyAllFilters));
}

// ---------- LOAD DATA & INIT ----------
async function init() {
    try {
        // ✅ FIXED: fetch from root folder (same as index.html)
        const res = await fetch('./business_data.json');
        if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
        fullData = await res.json();
        if (!fullData.length) throw new Error('Empty dataset');
        
        populateCheckboxes();
        
        // flatpickr date range (months)
        flatpickr(datePicker, {
            mode: "range",
            dateFormat: "Y-m",
            onChange: () => applyAllFilters()
        });
        
        // load state from URL
        const urlState = loadStateFromURL();
        if (urlState.depts.length) {
            urlState.depts.forEach(d => {
                const cb = document.querySelector(`#deptCheckboxes input[value="${d}"]`);
                if (cb) cb.checked = true;
            });
        }
        if (urlState.regions.length) {
            urlState.regions.forEach(r => {
                const cb = document.querySelector(`#regionCheckboxes input[value="${r}"]`);
                if (cb) cb.checked = true;
            });
        }
        if (urlState.search) searchInput.value = urlState.search;
        if (urlState.range) datePicker.value = urlState.range;
        
        applyAllFilters();
        
        searchInput.addEventListener('input', applyAllFilters);
        resetBtn.addEventListener('click', () => {
            document.querySelectorAll('#deptCheckboxes input, #regionCheckboxes input').forEach(cb => cb.checked = false);
            datePicker.value = '';
            searchInput.value = '';
            applyAllFilters();
        });
        exportBtn.addEventListener('click', exportCSV);
        initDarkMode();
        
    } catch (err) {
        console.error('Load error:', err);
        document.getElementById('tableBody').innerHTML = `<tr><td colspan="7" class="text-danger text-center">❌ Failed to load business_data.json. Make sure the file exists in the root folder and is valid JSON.</td></tr>`;
        document.querySelectorAll('.kpi-value').forEach(el => el.innerText = 'Error');
    }
}

init();
