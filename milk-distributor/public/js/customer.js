// Customer Management Functions
class CustomerManager {
    static async editCustomer(id) {
        try {
            const response = await fetch(`/distributor/customers/${id}`);
            const customer = await response.json();
            
            // Populate edit modal
            document.getElementById('editCustomerId').value = customer._id;
            document.getElementById('editName').value = customer.name;
            document.getElementById('editPhone').value = customer.phone;
            document.getElementById('editStreet').value = customer.address.street;
            document.getElementById('editCity').value = customer.address.city;
            document.getElementById('editState').value = customer.address.state;
            document.getElementById('editZipCode').value = customer.address.zipCode;
            document.getElementById('editSubscriptionPlan').value = customer.customerFields.subscriptionPlan;
            document.getElementById('editMilkQuantity').value = customer.customerFields.milkQuantity;
            document.getElementById('editDeliveryTime').value = customer.customerFields.deliveryTime;
            document.getElementById('editActive').checked = customer.customerFields.active;

            new bootstrap.Modal(document.getElementById('editCustomerModal')).show();
        } catch (err) {
            console.error('Error:', err);
            showToast('error', 'Error loading customer details');
        }
    }

    static async updateCustomer(id, formData) {
        try {
            const response = await fetch(`/distributor/customers/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) throw new Error('Update failed');
            
            showToast('success', 'Customer updated successfully');
            window.location.reload();
        } catch (err) {
            console.error('Error:', err);
            showToast('error', 'Error updating customer');
        }
    }

    static async toggleStatus(id) {
        if (!confirm('Are you sure you want to change this customer\'s status?')) return;

        try {
            const response = await fetch(`/distributor/customers/${id}/toggle-status`, {
                method: 'PUT'
            });

            if (!response.ok) throw new Error('Status update failed');
            
            showToast('success', 'Customer status updated');
            window.location.reload();
        } catch (err) {
            console.error('Error:', err);
            showToast('error', 'Error updating customer status');
        }
    }
}

// Global event handlers
document.addEventListener('DOMContentLoaded', () => {
    const editForm = document.getElementById('editCustomerForm');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('editCustomerId').value;
            const formData = {
                name: document.getElementById('editName').value,
                phone: document.getElementById('editPhone').value,
                address: {
                    street: document.getElementById('editStreet').value,
                    city: document.getElementById('editCity').value,
                    state: document.getElementById('editState').value,
                    zipCode: document.getElementById('editZipCode').value
                },
                customerFields: {
                    subscriptionPlan: document.getElementById('editSubscriptionPlan').value,
                    milkQuantity: document.getElementById('editMilkQuantity').value,
                    deliveryTime: document.getElementById('editDeliveryTime').value,
                    active: document.getElementById('editActive').checked
                }
            };
            await CustomerManager.updateCustomer(id, formData);
        });
    }
});

// Expose functions globally
window.editCustomer = (id) => CustomerManager.editCustomer(id);
window.toggleCustomerStatus = (id) => CustomerManager.toggleStatus(id);
