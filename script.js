// Global variables
let fullDataset = [];          // original JSON data
let currentFilteredData = []; // data after dept/region/period filters
let revenueChart, expensesChart, revenuePieChart;

// DOM elements
const deptSelect = document.getElementById('filterDept');
const regionSelect = document.getElementById('filterRegion');
const fromMonthSelect = document.getElementById('filterFromMonth');
const toMonthSelect = document.getElementById('filterToMonth');
const resetBtn = document.getElementById('resetFiltersBtn');
const searchInput = document.getElementById('tableSearchInput');
const tableBody = document.getElementById('dataTableBody');

// KPI elements
const totalRevenueEl = document.getElementById('totalRevenue');
const totalExpensesEl = document.getElementById('totalExpenses');
const totalProfitEl = document.getElementById('totalProfit');
const revenueVsTargetEl = document.getElementById('revenueVsTarget');
const targetAchieveSpan = document.getElementById('targetAchieveText');

// Helper: format currency Pula
function formatPula(amount) {
    return 'P ' + amount.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0});
}

// Helper: get unique months from dataset (YYYY-MM)
function getUniqueMonths(data) {
    const monthsSet = new Set();
    data.forEach(record => {
        if (record.date) monthsSet.add(record.date);
    });
    return Array.from(monthsSet).sort();
}

// Populate department dropdown
function populateDepartments() {
    const depts = [...new Set(fullDataset.map(d => d.department))].sort();
    deptSelect.innerHTML = '<option value="ALL">📌 All Departments</option>';
    depts.forEach(dept => {
        deptSelect.innerHTML += `<option value="${dept}">${dept}</option>`;
    });
}

// Populate region dropdown
function populateRegions() {
    const regions = [...new Set(fullDataset.map(d => d.region))].sort();
    regionSelect.innerHTML = '<option value="ALL">🌍 All Regions</option>';
    regions.forEach(region => {
        regionSelect.innerHTML += `<option value="${region}">${region}</option>`;
    });
}

// Populate month range selects
function populateMonthRangeSelects() {
    const months = getUniqueMonths(fullDataset);
    if (months.length === 0) return;
    fromMonthSelect.innerHTML = '';
    toMonthSelect.innerHTML = '';
    months.forEach(month => {
        const optionFrom = document.createElement('option');
        optionFrom.value = month;
        optionFrom.textContent = formatMonthLabel(month);
        fromMonthSelect.appendChild(optionFrom);
        
        const optionTo = document.createElement('option');
        optionTo.value = month;
        optionTo.textContent = formatMonthLabel(month);
        toMonthSelect.appendChild(optionTo);
    });
    fromMonthSelect.value = months[0];
    toMonthSelect.value = months[months.length-1];
}

function formatMonthLabel(ym) {
    const [year, month] = ym.split('-');
    const date = new Date(year, month-1, 1);
    return date.toLocaleString('default', { month: 'short', year: 'numeric' });
}

// Filter logic
function applyFilters() {
    let filtered = [...fullDataset];
    
    const deptVal = deptSelect.value;
    if (deptVal !== 'ALL') {
        filtered = filtered.filter(rec => rec.department === deptVal);
    }
    const regionVal = regionSelect.value;
    if (regionVal !== 'ALL') {
        filtered = filtered.filter(rec => rec.region === regionVal);
    }
    const fromMonth = fromMonthSelect.value;
    const toMonth = toMonthSelect.value;
    if (fromMonth && toMonth) {
        filtered = filtered.filter(rec => rec.date >= fromMonth && rec.date <= toMonth);
    }
    return filtered;
}

// Update KPIs
function updateKPIs(filteredData) {
    let totalRevenue = 0, totalExpenses = 0, totalTargetRevenue = 0;
    filteredData.forEach(rec => {
        totalRevenue += rec.revenue;
        totalExpenses += rec.expenses;
        totalTargetRevenue += rec.targetRevenue;
    });
    const totalProfit = totalRevenue - totalExpenses;
    totalRevenueEl.innerText = formatPula(totalRevenue);
    totalExpensesEl.innerText = formatPula(totalExpenses);
    totalProfitEl.innerText = formatPula(totalProfit);
    
    let vsTargetPercent = 0;
    if (totalTargetRevenue > 0) {
        vsTargetPercent = (totalRevenue / totalTargetRevenue) * 100;
    }
    revenueVsTargetEl.innerText = vsTargetPercent.toFixed(1) + '%';
    targetAchieveSpan.innerText = `${formatPula(totalRevenue)} / ${formatPula(totalTargetRevenue)} target`;
    revenueVsTargetEl.style.color = vsTargetPercent >= 100 ? '#198754' : '#dc3545';
}

// Chart data preparation
function prepareMonthlyRevenue(filteredData) {
    const monthMap = new Map();
    filteredData.forEach(rec => {
        monthMap.set(rec.date, (monthMap.get(rec.date) || 0) + rec.revenue);
    });
    const sortedMonths = Array.from(monthMap.keys()).sort();
    const revenues = sortedMonths.map(m => monthMap.get(m));
    const labels = sortedMonths.map(m => formatMonthLabel(m));
    return { labels, revenues };
}

function prepareExpensesByDept(filteredData) {
    const deptMap = new Map();
    filteredData.forEach(rec => {
        deptMap.set(rec.department, (deptMap.get(rec.department) || 0) + rec.expenses);
    });
    const departments = Array.from(deptMap.keys()).sort();
    const expenses = departments.map(d => deptMap.get(d));
    return { departments, expenses };
}

function prepareRevenueByDept(filteredData) {
    const deptRevMap = new Map();
    filteredData.forEach(rec => {
        deptRevMap.set(rec.department, (deptRevMap.get(rec.department) || 0) + rec.revenue);
    });
    const departments = Array.from(deptRevMap.keys()).sort();
    const revenues = departments.map(d => deptRevMap.get(d));
    return { departments, revenues };
}

// Destroy existing charts
function destroyCharts() {
    if (revenueChart) { revenueChart.destroy(); revenueChart = null; }
    if (expensesChart) { expensesChart.destroy(); expensesChart = null; }
    if (revenuePieChart) { revenuePieChart.destroy(); revenuePieChart = null; }
}

// Render all charts
function renderCharts(filteredData) {
    destroyCharts();
    
    // Line Chart
    const monthlyData = prepareMonthlyRevenue(filteredData);
    const ctxLine = document.getElementById('revenueLineChart').getContext('2d');
    revenueChart = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: monthlyData.labels,
            datasets: [{
                label: 'Revenue (Pula)',
                data: monthlyData.revenues,
                borderColor: '#2c7da0',
                backgroundColor: 'rgba(44,125,160,0.05)',
                borderWidth: 3,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#1f5068',
                pointRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (ctx) => `P ${ctx.raw.toLocaleString()}` } } } }
    });
    
    // Bar Chart
    const barData = prepareExpensesByDept(filteredData);
    const ctxBar = document.getElementById('expensesBarChart').getContext('2d');
    expensesChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: barData.departments,
            datasets: [{
                label: 'Expenses (P)',
                data: barData.expenses,
                backgroundColor: '#e76f51',
                borderRadius: 8,
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (ctx) => `P ${ctx.raw.toLocaleString()}` } } } }
    });
    
    // Pie Chart
    const pieData = prepareRevenueByDept(filteredData);
    const totalRev = pieData.revenues.reduce((a,b) => a+b, 0);
    const ctxPie = document.getElementById('revenuePieChart').getContext('2d');
    revenuePieChart = new Chart(ctxPie, {
        type: 'pie',
        data: {
            labels: pieData.departments,
            datasets: [{
                data: pieData.revenues,
                backgroundColor: ['#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', '#8ecae6', '#219ebc'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.label}: ${formatPula(ctx.raw)} (${((ctx.raw / totalRev)*100).toFixed(1)}%)`
                    }
                }
            }
        }
    });
}

// Render data table with search
function renderTableWithSearch() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    let rowsData = [...currentFilteredData];
    if (searchTerm !== '') {
        rowsData = rowsData.filter(rec => {
            return rec.date.toLowerCase().includes(searchTerm) ||
                   rec.department.toLowerCase().includes(searchTerm) ||
                   rec.region.toLowerCase().includes(searchTerm) ||
                   rec.revenue.toString().includes(searchTerm) ||
                   rec.expenses.toString().includes(searchTerm) ||
                   (rec.revenue - rec.expenses).toString().includes(searchTerm) ||
                   rec.targetRevenue.toString().includes(searchTerm);
        });
    }
    
    if (rowsData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">📭 No records match the current filters/search</td></tr>';
        return;
    }
    
    let html = '';
    rowsData.forEach(rec => {
        const profit = rec.revenue - rec.expenses;
        html += `<tr>
                    <td>${formatMonthLabel(rec.date)}</td>
                    <td>${rec.department}</td>
                    <td>${rec.region}</td>
                    <td class="fw-semibold">${formatPula(rec.revenue)}</td>
                    <td>${formatPula(rec.expenses)}</td>
                    <td class="${profit>=0?'text-success':'text-danger'}">${formatPula(profit)}</td>
                    <td>${formatPula(rec.targetRevenue)}</td>
                 </tr>`;
    });
    tableBody.innerHTML = html;
}

// Main update function
function updateDashboard() {
    const filtered = applyFilters();
    currentFilteredData = filtered;
    updateKPIs(filtered);
    renderCharts(filtered);
    renderTableWithSearch();
}

// Reset all filters
function resetAllFilters() {
    deptSelect.value = 'ALL';
    regionSelect.value = 'ALL';
    const months = getUniqueMonths(fullDataset);
    if (months.length) {
        fromMonthSelect.value = months[0];
        toMonthSelect.value = months[months.length-1];
    }
    searchInput.value = '';
    updateDashboard();
}

// Load JSON and initialize
async function loadDataAndInit() {
    try {
        const response = await fetch('./data/business_data.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const jsonData = await response.json();
        fullDataset = jsonData;
        if (!fullDataset.length) throw new Error('Empty dataset');
        
        populateDepartments();
        populateRegions();
        populateMonthRangeSelects();
        
        deptSelect.addEventListener('change', updateDashboard);
        regionSelect.addEventListener('change', updateDashboard);
        fromMonthSelect.addEventListener('change', updateDashboard);
        toMonthSelect.addEventListener('change', updateDashboard);
        resetBtn.addEventListener('click', resetAllFilters);
        searchInput.addEventListener('input', () => renderTableWithSearch());
        
        updateDashboard();
    } catch (error) {
        console.error('Error loading business data:', error);
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">⚠️ Failed to load data/business_data.json. Make sure the file exists and is valid.</td></tr>`;
        document.querySelectorAll('.kpi-value').forEach(el => el.innerText = 'Error');
    }
}

document.addEventListener('DOMContentLoaded', loadDataAndInit);
