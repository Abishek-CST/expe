/**
 * Expense Tracker Application Logic
 * Integrates with Supabase Backend.
 */

// ============================================
// SUPABASE CONFIGURATION: REPLACE THESE WITH YOUR OWN!
// ============================================
const SUPABASE_URL = 'https://cyonbxdhebqwktigfexp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z9LXbdsEY1EvMaZZmxA9_g_KnEXflAn';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// STATE MANAGEMENT & LOGIC
// ============================================
class ExpenseManager {
    constructor() {
        this.expenses = [];
        this.budget = 1000; // Default
        this.theme = 'light';
        
        // Colors mapping for charts and badges
        this.categoryColors = {
            'Food': '#ef4444', 
            'Transport': '#3b82f6', 
            'Bills': '#f59e0b', 
            'Entertainment': '#8b5cf6', 
            'Health': '#10b981', 
            'Other': '#64748b'
        };
    }

    async init() {
        await this.loadSettings();
        await this.loadExpenses();
    }

    async loadSettings() {
        try {
            const { data, error } = await supabase.from('settings').select('*');
            if (!error && data) {
                const budgetSetting = data.find(s => s.key === 'budget');
                if (budgetSetting) this.budget = budgetSetting.value.monthly;

                const themeSetting = data.find(s => s.key === 'theme');
                if (themeSetting) {
                    this.theme = themeSetting.value.mode;
                    if (this.theme === 'dark') document.body.classList.add('dark-mode');
                }
            }
        } catch (e) { console.error("Error loading settings", e); }
    }

    async updateBudget(newBudget) {
        this.budget = parseFloat(newBudget);
        await supabase.from('settings').upsert({ key: 'budget', value: { monthly: this.budget } });
    }

    async toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        if (this.theme === 'dark') {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        await supabase.from('settings').upsert({ key: 'theme', value: { mode: this.theme } });
        return this.theme;
    }

    async loadExpenses() {
        try {
            const { data, error } = await supabase
                .from('expenses')
                .select('*')
                .order('date', { ascending: false });
            
            if (error) throw error;
            this.expenses = data || [];
        } catch (e) {
            console.error("Error loading expenses (Verify Supabase connection details).", e);
            // Fallback for demonstration if Supabase is not connected
            ui.showToast('Could not fetch from Supabase. Ensure URL/Key are set.', 'error');
        }
    }

    async addExpense(expense) {
        try {
            const { data, error } = await supabase
                .from('expenses')
                .insert([expense])
                .select();
            if (error) throw error;
            this.expenses.unshift(data[0]); // Add to start
            this.expenses.sort((a,b) => new Date(b.date) - new Date(a.date));
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    async deleteExpense(id) {
        try {
            const { error } = await supabase.from('expenses').delete().eq('id', id);
            if (error) throw error;
            this.expenses = this.expenses.filter(e => e.id !== id);
            return true;
        } catch(e) {
            console.error(e);
            return false;
        }
    }

    async clearAllExpenses() {
        try {
            // Usually, deleting all involves filtering by user_id, 
            // since we don't have auth, we delete all greater than a long ago date
            const { error } = await supabase.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) throw error;
            this.expenses = [];
            return true;
        } catch(e) { console.error(e); return false; }
    }

    getSummary() {
        const total = this.expenses.reduce((sum, item) => sum + parseFloat(item.amount), 0);
        
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        const monthly = this.expenses.filter(e => {
            const date = new Date(e.date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        }).reduce((sum, item) => sum + parseFloat(item.amount), 0);

        return { total, monthly };
    }

    getCategoryWiseData() {
        const data = {};
        this.expenses.forEach(e => {
            data[e.category] = (data[e.category] || 0) + parseFloat(e.amount);
        });
        return data;
    }

    getMonthlyTrends() {
        const data = {};
        this.expenses.forEach(e => {
            const monthStr = e.date.substring(0, 7); // YYYY-MM
            data[monthStr] = (data[monthStr] || 0) + parseFloat(e.amount);
        });
        
        // Sort keys chronologically
        const sortedKeys = Object.keys(data).sort();
        const result = { labels: [], values: [] };
        sortedKeys.forEach(k => {
            result.labels.push(k);
            result.values.push(data[k]);
        });
        return result;
    }
}

// ============================================
// UI CONTROLLER
// ============================================
class UIController {
    constructor(manager) {
        this.manager = manager;
        this.charts = {};
        
        // Set fixed current date display
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('currentDateDisplay').textContent = new Date().toLocaleDateString('en-US', dateOptions);
    }

    async render() {
        this.updateDashboardCards();
        this.renderRecentTransactions();
        this.renderAllTransactions();
        this.renderCharts();
        this.renderInsights();
    }

    updateDashboardCards() {
        const { total, monthly } = this.manager.getSummary();
        const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
        
        document.getElementById('totalExpenses').textContent = formatter.format(total);
        document.getElementById('monthlyExpenses').textContent = formatter.format(monthly);
        document.getElementById('monthlyBudget').textContent = formatter.format(this.manager.budget);

        // Budget Progress
        const progressPercentage = Math.min((monthly / this.manager.budget) * 100, 100);
        const progressBar = document.getElementById('budgetProgress');
        progressBar.style.width = `${progressPercentage}%`;
        
        const warning = document.getElementById('budgetWarning');
        if (progressPercentage >= 100) {
            progressBar.style.backgroundColor = 'var(--danger-color)';
            warning.textContent = 'Budget exceeded!';
            warning.style.color = 'var(--danger-color)';
            warning.classList.remove('hidden');
        } else if (progressPercentage >= 80) {
            progressBar.style.backgroundColor = 'var(--warning-color)';
            warning.textContent = 'Nearing budget limit!';
            warning.style.color = 'var(--warning-color)';
            warning.classList.remove('hidden');
        } else {
            progressBar.style.backgroundColor = 'var(--success-color)';
            warning.classList.add('hidden');
        }
    }

    getCategoryBadge(category) {
        const color = this.manager.categoryColors[category] || this.manager.categoryColors['Other'];
        return `<span class="category-badge" style="background-color: ${color}20; color: ${color}; border: 1px solid ${color}40">${category}</span>`;
    }

    renderRecentTransactions() {
        const tbody = document.querySelector('#recentTransactionsTable tbody');
        tbody.innerHTML = '';
        const emptyState = document.getElementById('emptyRecentState');
        const table = document.getElementById('recentTransactionsTable');
        
        // Handle Empty state
        if (this.manager.expenses.length === 0) {
            emptyState.classList.remove('hidden');
            table.classList.add('hidden');
            return;
        }
        
        emptyState.classList.add('hidden');
        table.classList.remove('hidden');

        const recent = this.manager.expenses.slice(0, 5); // top 5
        recent.forEach(exp => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(exp.date).toLocaleDateString()}</td>
                <td style="font-weight:500;">${exp.description}</td>
                <td>${this.getCategoryBadge(exp.category)}</td>
                <td style="font-weight:700;">$${parseFloat(exp.amount).toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    renderAllTransactions() {
        const tbody = document.querySelector('#allTransactionsTable tbody');
        tbody.innerHTML = '';
        const emptyState = document.getElementById('emptyTransactionsState');
        const table = document.getElementById('allTransactionsTable');
        
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const catFilter = document.getElementById('categoryFilter').value;
        const monthFilter = document.getElementById('monthFilter').value;

        const filtered = this.manager.expenses.filter(exp => {
            const matchSearch = exp.description.toLowerCase().includes(searchTerm);
            const matchCat = catFilter === 'All' || exp.category === catFilter;
            const matchMonth = !monthFilter || exp.date.substring(0,7) === monthFilter;
            return matchSearch && matchCat && matchMonth;
        });

        if (filtered.length === 0) {
            emptyState.classList.remove('hidden');
            table.classList.add('hidden');
            return;
        }
        
        emptyState.classList.add('hidden');
        table.classList.remove('hidden');

        filtered.forEach(exp => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(exp.date).toLocaleDateString()}</td>
                <td style="font-weight:500;">${exp.description}</td>
                <td>${this.getCategoryBadge(exp.category)}</td>
                <td style="font-weight:700;">$${parseFloat(exp.amount).toFixed(2)}</td>
                <td>
                    <button class="btn-icon delete-btn" data-id="${exp.id}" title="Delete" style="width:32px;height:32px;color:var(--danger-color)">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        // Attach delete listeners
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if(confirm("Delete this expense?")) {
                    const success = await this.manager.deleteExpense(id);
                    if(success) {
                        this.showToast('Expense deleted successfully.', 'success');
                        this.render();
                    } else {
                        this.showToast('Error deleting expense.', 'error');
                    }
                }
            });
        });
    }

    renderCharts() {
        // Shared Chart configs
        Chart.defaults.color = getComputedStyle(document.body).getPropertyValue('--text-secondary').trim();
        Chart.defaults.font.family = "'Outfit', sans-serif";

        const categoryData = this.manager.getCategoryWiseData();
        const catLabels = Object.keys(categoryData);
        const catValues = Object.values(categoryData);
        const catBgColors = catLabels.map(l => this.manager.categoryColors[l] || '#ccc');

        // Destroy previous charts if exist
        if(this.charts.pie) this.charts.pie.destroy();
        if(this.charts.bar) this.charts.bar.destroy();
        if(this.charts.line) this.charts.line.destroy();

        // Pie Chart
        const ctxPie = document.getElementById('categoryChart').getContext('2d');
        this.charts.pie = new Chart(ctxPie, {
            type: 'doughnut',
            data: {
                labels: catLabels,
                datasets: [{ data: catValues, backgroundColor: catBgColors, borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right' } } }
        });

        // Bar Chart (Monthly Trends)
        const trendData = this.manager.getMonthlyTrends();
        const ctxBar = document.getElementById('trendChart').getContext('2d');
        
        const isDarkMode = document.body.classList.contains('dark-mode');
        const gridColor = isDarkMode ? '#334155' : '#e2e8f0';

        this.charts.bar = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: trendData.labels,
                datasets: [{
                    label: 'Expenses',
                    data: trendData.values,
                    backgroundColor: 'rgba(79, 70, 229, 0.8)',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: gridColor } },
                    x: { grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });

        // Line Chart (Analytics page)
        const ctxLine = document.getElementById('historyLineChart').getContext('2d');
        this.charts.line = new Chart(ctxLine, {
            type: 'line',
            data: {
                labels: trendData.labels,
                datasets: [{
                    label: 'Total Expenses',
                    data: trendData.values,
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: gridColor } },
                    x: { grid: { color: gridColor } }
                }
            }
        });
    }

    renderInsights() {
        const insightsList = document.getElementById('insightsList');
        insightsList.innerHTML = '';
        
        if(this.manager.expenses.length === 0) {
            insightsList.innerHTML = '<li><i class="fa-solid fa-circle-info insight-icon"></i><div>Not enough data to calculate insights. Add some expenses first!</div></li>';
            return;
        }

        const categoryData = this.manager.getCategoryWiseData();
        let highestCat = '';
        let highestVal = 0;
        for (const [key, value] of Object.entries(categoryData)) {
            if(value > highestVal) { highestVal = value; highestCat = key; }
        }

        const { total, monthly } = this.manager.getSummary();
        const percentOfBudget = ((monthly / this.manager.budget) * 100).toFixed(1);

        const insights = [
            `Your highest spending category is <strong>${highestCat}</strong> at $${highestVal.toFixed(2)}.`,
            `You have consumed <strong>${percentOfBudget}%</strong> of your monthly budget.`,
            `You have recorded a total of <strong>${this.manager.expenses.length}</strong> transactions so far.`
        ];

        insights.forEach(text => {
            const li = document.createElement('li');
            li.innerHTML = `<i class="fa-solid fa-lightbulb insight-icon"></i><div>${text}</div>`;
            insightsList.appendChild(li);
        });
    }

    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation';
        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// ============================================
// INITIALIZATION AND EVENT BINDINGS
// ============================================
const manager = new ExpenseManager();
const ui = new UIController(manager);

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize data from Supabase
    await manager.init();
    ui.render();

    // 2. Navigation
    document.querySelectorAll('.nav-links li').forEach(li => {
        li.addEventListener('click', (e) => {
            // Update active state in nav
            document.querySelectorAll('.nav-links li').forEach(el => el.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            // Show correct section
            const sectionId = e.currentTarget.getAttribute('data-section');
            document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active', 'hidden'));
            document.querySelectorAll('.content-section').forEach(sec => {
                if(sec.id !== sectionId) sec.classList.add('hidden');
            });
            
            // Adjust title
            document.getElementById('pageTitle').textContent = e.currentTarget.textContent.trim();
        });
    });

    // Sub-navigation triggers
    document.querySelector('.goto-transactions').addEventListener('click', () => {
        document.querySelector('.nav-links li[data-section="transactions"]').click();
    });

    // 3. Modals handling
    const expenseModal = document.getElementById('expenseModal');
    const settingsModal = document.getElementById('settingsModal');

    document.getElementById('addExpenseBtn').addEventListener('click', () => {
        document.getElementById('expenseForm').reset();
        document.getElementById('expenseDate').valueAsDate = new Date();
        expenseModal.classList.add('active');
    });

    document.getElementById('settingsBtn').addEventListener('click', () => {
        document.getElementById('budgetInput').value = manager.budget;
        settingsModal.classList.add('active');
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            expenseModal.classList.remove('active');
            settingsModal.classList.remove('active');
        });
    });

    // 4. Forms Submission
    document.getElementById('expenseForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const expense = {
            amount: parseFloat(document.getElementById('expenseAmount').value),
            description: document.getElementById('expenseDescription').value,
            category: document.getElementById('expenseCategory').value,
            date: document.getElementById('expenseDate').value
        };

        const success = await manager.addExpense(expense);
        if (success) {
            ui.showToast('Expense added successfully!');
            expenseModal.classList.remove('active');
            ui.render();
        } else {
            ui.showToast('Failed to add expense.', 'error');
        }
    });

    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newBudget = document.getElementById('budgetInput').value;
        await manager.updateBudget(newBudget);
        ui.showToast('Settings saved successfully!');
        settingsModal.classList.remove('active');
        ui.render();
    });

    // 5. Filters
    document.getElementById('searchInput').addEventListener('input', () => ui.renderAllTransactions());
    document.getElementById('categoryFilter').addEventListener('change', () => ui.renderAllTransactions());
    document.getElementById('monthFilter').addEventListener('change', () => ui.renderAllTransactions());

    // 6. Global Actions
    document.getElementById('themeToggle').addEventListener('click', async () => {
        const newTheme = await manager.toggleTheme();
        const isDark = newTheme === 'dark';
        document.getElementById('themeToggle').innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
        ui.renderCharts(); // Re-render charts for color updates
    });
    
    // Set initial toggle icon
    if(manager.theme === 'dark') {
        document.getElementById('themeToggle').innerHTML = '<i class="fa-solid fa-sun"></i>';
    }

    document.getElementById('clearDataBtn').addEventListener('click', async () => {
        if(confirm("Are you sure you want to delete ALL expenses? This cannot be undone.")) {
            const success = await manager.clearAllExpenses();
            if(success) {
                ui.showToast('All records deleted.');
                ui.render();
            } else {
                ui.showToast('Error deleting records.', 'error');
            }
        }
    });

    document.getElementById('exportCsvBtn').addEventListener('click', () => {
        if(manager.expenses.length === 0) {
            ui.showToast('No data to export.', 'error');
            return;
        }

        const headers = ['Date', 'Description', 'Category', 'Amount'];
        const csvRows = [headers.join(',')];
        
        manager.expenses.forEach(exp => {
            const row = [
                exp.date,
                `"${exp.description}"`, // Handle commas in description
                exp.category,
                exp.amount
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `expenses_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        ui.showToast('Export downloaded successfully.');
    });
});
