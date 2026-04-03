// DOM elements
const deptSelect = document.getElementById('filterDept');
const regionSelect = document.getElementById('filterRegion');
const fromMonth = document.getElementById('filterFromMonth');
const toMonth = document.getElementById('filterToMonth');
const resetBtn = document.getElementById('resetFiltersBtn');
const searchInput = document.getElementById('tableSearch');
const tableBody = document.getElementById('tableBody');

let fullData = [];
let filteredData = [];
let revenueChart, expensesChart, revenuePieChart;

function formatPula(amount) {
    return 'P ' + amount.toLocaleString();
}

function formatMonthLabel(ym) {
    const [year, month] = ym.split('-');
    const d = new Date(year, month-1, 1);
    return d.toLocaleString('default', { month: 'short', year: 'numeric' });
}

function getUniqueMonths(data) {
    return [...new Set(data.map(d => d.date))].sort();
}

function populateDropdowns() {
    const depts = [...new Set(fullData.map(d => d.department))].sort();
    deptSelect.innerHTML = '<option value="ALL">All Departments</option>' + depts.map(d => `<option value="${d}">${d}</option>`).join('');
    const regions = [...new Set(fullData.map(d => d.region))].sort();
    regionSelect.innerHTML = '<option value="ALL">All Regions</option>' + regions.map(r => `<option value="${r}">${r}</option>`).join('');
    
    const months = getUniqueMonths(fullData);
    fromMonth.innerHTML = months.map(m => `<option value="${m}">${formatMonthLabel(m)}</option>`).join('');
    toMonth.innerHTML = months.map(m => `<option value="${m}">${formatMonthLabel(m)}</option>`).join('');
    if (months.length) {
        fromMonth.value = months[0];
        toMonth.value = months[months.length-1];
    }
}

function applyFilters() {
    let data = [...fullData];
    const dept = deptSelect.value;
    if (dept !== 'ALL') data = data.filter(d => d.department === dept);
    const region = regionSelect.value;
    if (region !== 'ALL') data = data.filter(d => d.region === region);
    const from = fromMonth.value;
    const to = toMonth.value;
    if (from && to) data = data.filter(d => d.date >= from && d.date <= to);
    const search = searchInput.value.trim().toLowerCase();
    if (search) {
        data = data.filter(d => 
            d.date.includes(search) ||
            d.department.toLowerCase().includes(search) ||
            d.region.toLowerCase().includes(search) ||
            d.revenue.toString().includes(search) ||
            d.expenses.toString().includes(search)
        );
    }
    filteredData = data;
    updateKPIs();
    updateCharts();
    updateTable();
}

function updateKPIs() {
    let revenue = 0, expenses = 0, target = 0;
    filteredData.forEach(d => { revenue += d.revenue; expenses += d.expenses; target += d.targetRevenue; });
    const profit = revenue - expenses;
    document.getElementById('totalRevenue').innerText = formatPula(revenue);
    document.getElementById('totalExpenses').innerText = formatPula(expenses);
    document.getElementById('totalProfit').innerText = formatPula(profit);
    const margin = revenue ? (profit / revenue * 100).toFixed(1) : 0;
    document.getElementById('profitMargin').innerHTML = `margin: ${margin}%`;
    const vsTarget = target ? (revenue / target * 100) : 0;
    document.getElementById('revenueVsTarget').innerText = vsTarget.toFixed(1) + '%';
    document.getElementById('targetProgress').style.width = Math.min(vsTarget, 100) + '%';
}

function updateCharts() {
    if (revenueChart) revenueChart.destroy();
    if (expensesChart) expensesChart.destroy();
    if (revenuePieChart) revenuePieChart.destroy();

    // Line chart: monthly revenue
    const monthly = {};
    filteredData.forEach(d => { monthly[d.date] = (monthly[d.date] || 0) + d.revenue; });
    const months = Object.keys(monthly).sort();
    const revData = months.map(m => monthly[m]);
    const ctxLine = document.getElementById('revenueLineChart').getContext('2d');
    revenueChart = new Chart(ctxLine, {
        type: 'line',
        data: { labels: months.map(m => formatMonthLabel(m)), datasets: [{ label: 'Revenue (P)', data: revData, borderColor: '#2c7da0', tension: 0.3, fill: false }] }
    });

    // Bar chart: expenses by department
    const deptExp = {};
    filteredData.forEach(d => { deptExp[d.department] = (deptExp[d.department] || 0) + d.expenses; });
    const depts = Object.keys(deptExp);
    const expData = depts.map(d => deptExp[d]);
    const ctxBar = document.getElementById('expensesBarChart').getContext('2d');
    expensesChart = new Chart(ctxBar, {
        type: 'bar',
        data: { labels: depts, datasets: [{ label: 'Expenses (P)', data: expData, backgroundColor: '#e76f51' }] }
    });

    // Pie chart: revenue by department
    const deptRev = {};
    filteredData.forEach(d => { deptRev[d.department] = (deptRev[d.department] || 0) + d.revenue; });
    const ctxPie = document.getElementById('revenuePieChart').getContext('2d');
    revenuePieChart = new Chart(ctxPie, {
        type: 'pie',
        data: { labels: Object.keys(deptRev), datasets: [{ data: Object.values(deptRev), backgroundColor: ['#2a9d8f','#e9c46a','#f4a261','#e76f51'] }] }
    });
}

function updateTable() {
    if (!filteredData.length) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No matching records</td></tr>';
        return;
    }
    tableBody.innerHTML = filteredData.map(d => `
        <tr>
            <td>${d.date}</td>
            <td>${d.department}</td>
            <td>${d.region}</td>
            <td>${formatPula(d.revenue)}</td>
            <td>${formatPula(d.expenses)}</td>
            <td class="${d.revenue-d.expenses>=0?'text-success':'text-danger'}">${formatPula(d.revenue-d.expenses)}</td>
            <td>${formatPula(d.targetRevenue)}</td>
        </tr>
    `).join('');
}

function resetFilters() {
    deptSelect.value = 'ALL';
    regionSelect.value = 'ALL';
    const months = getUniqueMonths(fullData);
    if (months.length) {
        fromMonth.value = months[0];
        toMonth.value = months[months.length-1];
    }
    searchInput.value = '';
    applyFilters();
}

// Load JSON and initialize
async function init() {
    try {
        const response = await fetch('./business_data.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        fullData = await response.json();
        if (!fullData.length) throw new Error('Empty JSON');
        
        populateDropdowns();
        applyFilters();
        
        deptSelect.addEventListener('change', applyFilters);
        regionSelect.addEventListener('change', applyFilters);
        fromMonth.addEventListener('change', applyFilters);
        toMonth.addEventListener('change', applyFilters);
        resetBtn.addEventListener('click', resetFilters);
        searchInput.addEventListener('input', applyFilters);
    } catch (err) {
        console.error(err);
        tableBody.innerHTML = `<tr><td colspan="7" class="text-danger text-center">Error loading business_data.json. Make sure the file exists and is valid JSON.</td></tr>`;
    }
}

init();
