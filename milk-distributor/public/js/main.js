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
        let headers = {
            'Content-Type': 'application/json'
        };

        if (!(options.body instanceof FormData) && options.body) {
            options.body = JSON.stringify(options.body);
        }

        const response = await fetch(url, {
            ...options,
            headers: {
                ...headers,
                ...options.headers
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Network response was not ok');
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Request Error:', error);
        showToast('danger', error.message || 'An error occurred while processing your request');
        throw error;
    }
}

