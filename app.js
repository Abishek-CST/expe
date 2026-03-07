class ExpenseTrackerApp {
    constructor() {
        this.expenses = JSON.parse(localStorage.getItem('expenses')) || [];
        this.loans = JSON.parse(localStorage.getItem('loans')) || [];
        this.limit = localStorage.getItem('spendingLimit') || null;

        this.init();
    }

    init() {
        this.renderDashboard();
        this.updateSettingsDisplay();
        
        // Wait for DOM
        window.addEventListener('DOMContentLoaded', () => {
            this.initCharts();
        });
    }

    /* --- Navigation & UI --- */
    navigate(screenId) {
        // Toggle Sections
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');

        // Toggle Icons
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelector(`.nav-item[onclick="window.app.navigate('${screenId}')"]`).classList.add('active');

        // Refresh Data Contexts
        if (screenId === 'dashboard') this.renderDashboard();
        if (screenId === 'stats') this.renderCharts();
        if (screenId === 'loans') this.renderLoans();
    }

    openModal(modalId) {
        document.getElementById(modalId).classList.add('open');
        document.getElementById('modalOverlay').classList.add('open');
        
        // Setup defaults
        if(modalId === 'expenseModal') {
            document.getElementById('exp-date').valueAsDate = new Date();
        }
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('open'));
        document.getElementById('modalOverlay').classList.remove('open');
    }

    switchTab(btn, tabId) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
    }

    handleCategoryChange(val) {
        const group = document.getElementById('exp-custom-group');
        const input = document.getElementById('exp-custom');
        if (val === 'Other') {
            group.style.display = 'block';
            input.required = true;
        } else {
            group.style.display = 'none';
            input.required = false;
        }
    }

    showToast(message, color = 'var(--danger)') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.style.backgroundColor = color;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    /* --- Data Handling --- */
    saveExpense(e) {
        e.preventDefault();
        const rawAmount = parseFloat(document.getElementById('exp-amount').value);
        const category = document.getElementById('exp-category').value;
        const customTitle = document.getElementById('exp-custom').value;
        const date = document.getElementById('exp-date').value;

        const amount = Math.abs(rawAmount);

        const newExpense = {
            id: Date.now().toString(),
            amount: amount,
            category: category === 'Other' ? customTitle : category,
            date: date
        };

        this.expenses.push(newExpense);
        localStorage.setItem('expenses', JSON.stringify(this.expenses));
        this.checkLimit(amount);
        
        e.target.reset();
        this.handleCategoryChange('Food'); // Reset UI
        this.closeModals();
        this.renderDashboard();
        
        this.showToast('Expense Added!', 'var(--success)');
    }

    saveLoan(e) {
        e.preventDefault();
        const type = document.querySelector('input[name="loanType"]:checked').value; // gave | borrowed
        const person = document.getElementById('loan-person').value;
        const amount = parseFloat(document.getElementById('loan-amount').value);
        const notes = document.getElementById('loan-notes').value;

        const newLoan = {
            id: Date.now().toString(),
            type: type,
            person: person,
            amount: Math.abs(amount),
            notes: notes,
            date: new Date().toISOString().split('T')[0],
            isSettled: false
        };

        this.loans.push(newLoan);
        localStorage.setItem('loans', JSON.stringify(this.loans));
        
        e.target.reset();
        this.closeModals();
        this.renderLoans();
        
        this.showToast('Transaction Saved!', 'var(--success)');
    }

    toggleLoan(id) {
        const index = this.loans.findIndex(l => l.id === id);
        if (index > -1) {
            this.loans[index].isSettled = !this.loans[index].isSettled;
            localStorage.setItem('loans', JSON.stringify(this.loans));
            this.renderLoans();
        }
    }

    saveLimit(e) {
        e.preventDefault();
        const limit = document.getElementById('limit-amount').value;
        if(limit) {
            this.limit = parseFloat(limit);
            localStorage.setItem('spendingLimit', this.limit);
        } else {
            this.limit = null;
            localStorage.removeItem('spendingLimit');
        }
        this.updateSettingsDisplay();
        this.closeModals();
        this.showToast('Limit Updated', 'var(--success)');
    }

    checkLimit(newAmount) {
        if (!this.limit) return;
        
        const now = new Date();
        const currentMonthString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        const monthlyTotal = this.expenses
            .filter(e => e.date.startsWith(currentMonthString))
            .reduce((sum, e) => sum + e.amount, 0);

        if (monthlyTotal > this.limit) {
            this.showToast(`Warning! You exceeded your $${this.limit} monthly limit.`);
        }
    }

    clearData() {
        if(confirm("Are you sure you want to permanently delete all expenses and loans?")) {
            localStorage.clear();
            this.expenses = [];
            this.loans = [];
            this.limit = null;
            this.init();
            this.renderLoans();
            if(this.pieChart) this.pieChart.destroy();
            if(this.barChart) this.barChart.destroy();
            this.showToast('All Data Cleared', 'var(--primary-color)');
        }
    }

    /* --- Rendering --- */
    renderDashboard() {
        const today = new Date().toISOString().split('T')[0];
        const currentMonthString = today.substring(0, 7); // YYYY-MM

        let todayTotal = 0;
        let monthlyTotal = 0;

        // Sort expenses newest first
        this.expenses.sort((a,b) => new Date(b.date) - new Date(a.date));

        const listDiv = document.getElementById('recent-transactions');
        listDiv.innerHTML = '';

        this.expenses.forEach((e, index) => {
            if (e.date === today) todayTotal += e.amount;
            if (e.date.startsWith(currentMonthString)) monthlyTotal += e.amount;

            if (index < 10) { // Show only 10 recent
                const icon = this.getCategoryIcon(e.category);
                const html = `
                    <div class="transaction-card">
                        <div class="icon-wrapper"><i class='bx ${icon}'></i></div>
                        <div class="tx-info">
                            <h4>${e.category}</h4>
                            <p>${e.date}</p>
                        </div>
                        <div class="tx-amount">-$${e.amount.toFixed(2)}</div>
                    </div>
                `;
                listDiv.innerHTML += html;
            }
        });

        if (this.expenses.length === 0) {
             listDiv.innerHTML = '<p class="empty-state">No expenses yet. Add one!</p>';
        }

        document.getElementById('today-total').textContent = `$${todayTotal.toFixed(2)}`;
        document.getElementById('monthly-total').textContent = `$${monthlyTotal.toFixed(2)}`;
    }

    renderLoans() {
        const container = document.getElementById('loans-list');
        container.innerHTML = '';
        
        this.loans.sort((a,b) => new Date(b.date) - new Date(a.date));

        if (this.loans.length === 0) {
            container.innerHTML = '<p class="empty-state">No transactions yet.</p>';
            return;
        }

        this.loans.forEach(l => {
            const isGave = l.type === 'gave';
            const html = `
                <div class="transaction-card ${l.isSettled ? 'settled' : ''}">
                    <div class="icon-wrapper" style="color: ${isGave ? 'var(--success)' : 'var(--danger)'}">
                        <i class='bx ${isGave ? 'bx-up-arrow-circle' : 'bx-down-arrow-circle'}'></i>
                    </div>
                    <div class="tx-info">
                        <h4>${l.person}</h4>
                        <p>${l.date} ${l.notes ? '- ' + l.notes : ''}</p>
                        <button class="settle-btn" onclick="window.app.toggleLoan('${l.id}')">
                            ${l.isSettled ? 'Mark Unsettled' : 'Mark Settled'}
                        </button>
                    </div>
                    <div class="tx-amount ${isGave ? 'positive' : ''}">
                        ${isGave ? '+' : '-'}$${l.amount.toFixed(2)}
                    </div>
                </div>
            `;
            container.innerHTML += html;
        });
    }

    updateSettingsDisplay() {
        document.getElementById('current-limit-display').textContent = this.limit ? `$${this.limit}` : 'Not set';
    }

    getCategoryIcon(cat) {
        cat = cat.toLowerCase();
        if (cat.includes('food') || cat.includes('pizza') || cat.includes('burger')) return 'bx-restaurant';
        if (cat.includes('drink') || cat.includes('water')) return 'bx-drink';
        if (cat.includes('plant') || cat.includes('tea')) return 'bxs-leaf';
        if (cat.includes('nescafe') || cat.includes('coffee')) return 'bx-coffee-togo';
        if (cat.includes('travel') || cat.includes('flight')) return 'bxs-plane-alt';
        if (cat.includes('yogurt') || cat.includes('ice cream')) return 'bx-popsicle';
        return 'bx-purchase-tag';
    }

    /* --- Charts --- */
    initCharts() {
        this.renderCharts();
    }

    renderCharts() {
        if (this.expenses.length === 0) return;

        // Pie Chart
        const catMap = {};
        this.expenses.forEach(e => {
            catMap[e.category] = (catMap[e.category] || 0) + e.amount;
        });

        const pieCtx = document.getElementById('categoryPieChart');
        if (this.pieChart) this.pieChart.destroy();
        
        this.pieChart = new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(catMap),
                datasets: [{
                    data: Object.values(catMap),
                    backgroundColor: ['#CF6679', '#BB86FC', '#03DAC6', '#FFB74D', '#A1887F', '#4DD0E1', '#F06292'],
                    borderWidth: 0,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: {color: '#fff'} }
                }
            }
        });

        // Bar Chart (Monthly)
        const currentYear = new Date().getFullYear();
        const monthTotals = Array(12).fill(0);
        
        this.expenses.forEach(e => {
            if (e.date.startsWith(currentYear.toString())) {
                const m = parseInt(e.date.split('-')[1]) - 1;
                monthTotals[m] += e.amount;
            }
        });

        const barCtx = document.getElementById('monthlyBarChart');
        if (this.barChart) this.barChart.destroy();
        
        this.barChart = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: 'Expenses',
                    data: monthTotals,
                    backgroundColor: '#03DAC6',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { display: false },
                    x: { ticks: { color: 'rgba(255,255,255,0.7)' }, grid: {display: false} }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    /* --- Exports --- */
    exportCSV() {
        if(this.expenses.length === 0 && this.loans.length === 0) {
            this.showToast("No data to export"); return;
        }

        let csvContent = "data:text/csv;charset=utf-8,Type,Date,Category/Person,Amount,Status\n";
        
        this.expenses.forEach(e => {
            csvContent += `Expense,${e.date},${e.category},${e.amount},\n`;
        });

        this.loans.forEach(l => {
            const typeLabel = l.type === 'gave' ? 'Gave Money' : 'Borrowed';
            const status = l.isSettled ? 'Settled' : 'Pending';
            csvContent += `${typeLabel},${l.date},${l.person},${l.amount},${status}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "smart_expense_tracker_data.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showToast('CSV Exported!', 'var(--success)');
    }

    exportPDF() {
        if(this.expenses.length === 0 && this.loans.length === 0) {
            this.showToast("No data to export"); return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(22);
        doc.text("Smart Expense Tracker Report", 14, 20);

        // Expense Table
        doc.setFontSize(16);
        doc.text("Expenses", 14, 35);
        
        const expenseBody = this.expenses.map(e => [e.date, e.category, `$${e.amount.toFixed(2)}`]);
        doc.autoTable({
            startY: 40,
            head: [['Date', 'Category', 'Amount']],
            body: expenseBody,
        });

        // Loans Table
        const finalY = doc.lastAutoTable.finalY || 40;
        doc.text("Loans & Transactions", 14, finalY + 15);
        
        const loanBody = this.loans.map(l => [
            l.type === 'gave' ? 'Gave Money' : 'Borrowed',
            l.date, l.person, `$${l.amount.toFixed(2)}`, l.isSettled ? 'Settled' : 'Pending'
        ]);

        doc.autoTable({
            startY: finalY + 20,
            head: [['Type', 'Date', 'Person', 'Amount', 'Status']],
            body: loanBody,
        });

        doc.save('smart_expense_tracker_report.pdf');
        this.showToast('PDF Exported!', 'var(--success)');
    }
}

// Initialize Global Instance
window.app = new ExpenseTrackerApp();
