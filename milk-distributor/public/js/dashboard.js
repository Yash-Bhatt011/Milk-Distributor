// Toast notification helper
function showToast(type, message) {
    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center text-white bg-${type} border-0`;
    toastEl.setAttribute('role', 'alert');
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    const container = document.getElementById('toast-container') || document.body;
    container.appendChild(toastEl);
    
    const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
    toast.show();
    
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

// Form validation helper
function validateForm(formElement) {
    if (!formElement.checkValidity()) {
        formElement.classList.add('was-validated');
        return false;
    }
    return true;
}

// Date formatter
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

// Currency formatter
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
}

// API request helper
async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        return await response.json();
    } catch (error) {
        console.log("Enter");
        console.error('API Request Error:', error);
        showToast('danger', 'An error occurred while processing your request');
        throw error;
    }
}

// Generate deliveries for today
async function generateDeliveries() {
    try {
        // Disable button to prevent double submission
        const button = document.getElementById('generateBtn');
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Generating...';

        const response = await fetch('/distributor/deliveries/batch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        if (data.success) {
            showToast('success', `Successfully created ${data.message}`);
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            throw new Error(data.message || 'Failed to generate deliveries');
        }
    } catch (err) {
        console.error('Error:', err);
        showToast('danger', 'Error generating deliveries');
    } finally {
        // Re-enable button
        const button = document.getElementById('generateBtn');
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-sync me-2"></i>Generate Today\'s Deliveries';
    }
}