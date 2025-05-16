class AdminDashboard {
    static async init() {
        this.setupEventListeners();
        await this.loadDashboardStats();
    }

    static setupEventListeners() {
        // Distributor form handling
        const addDistributorForm = document.getElementById('addDistributorForm');
        if (addDistributorForm) {
            addDistributorForm.addEventListener('submit', this.handleDistributorSubmit.bind(this));
        }

        // Report date filters
        const reportDateFilter = document.getElementById('reportDateFilter');
        if (reportDateFilter) {
            reportDateFilter.addEventListener('change', this.handleReportFilter.bind(this));
        }
    }

    static async handleDistributorSubmit(event) {
        event.preventDefault();
        
        if (!validateForm(event.target)) return;

        const formData = new FormData(event.target);
        try {
            const response = await fetch('/admin/distributors', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(Object.fromEntries(formData))
            });

            const data = await response.json();
            if (data.success) {
                showToast('success', 'Distributor added successfully');
                window.location.reload();
            } else {
                throw new Error(data.message || 'Failed to add distributor');
            }
        } catch (error) {
            showToast('danger', error.message || 'Failed to add distributor');
        }
    }

    static async loadDashboardStats() {
        const statsContainer = document.getElementById('dashboardStats');
        if (!statsContainer) return;

        try {
            const stats = await apiRequest('/admin/dashboard/stats');
            this.updateDashboardStats(stats);
        } catch (error) {
            console.error('Failed to load dashboard stats:', error);
        }
    }

    static updateDashboardStats(stats) {
        Object.entries(stats).forEach(([key, value]) => {
            const element = document.getElementById(`stat-${key}`);
            if (element) {
                if (key.includes('revenue')) {
                    element.textContent = formatCurrency(value);
                } else {
                    element.textContent = value;
                }
            }
        });
    }

    static async handleReportFilter(event) {
        const { startDate, endDate } = event.target.value;
        try {
            const data = await apiRequest(`/admin/reports/revenue?startDate=${startDate}&endDate=${endDate}`);
            this.updateRevenueChart(data);
        } catch (error) {
            console.error('Failed to load report data:', error);
        }
    }

    static updateRevenueChart(data) {
        // Implement chart update logic here
        // Using your preferred charting library (e.g., Chart.js)
    }
}

// Initialize admin dashboard when document is ready
document.addEventListener('DOMContentLoaded', () => AdminDashboard.init());
