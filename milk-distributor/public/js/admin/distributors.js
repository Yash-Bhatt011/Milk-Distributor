// Client-side distributor management

function editDistributor(id) {
    fetch(`/admin/distributors/${id}`)
        .then(res => res.json())
        .then(distributor => {
            document.getElementById('editId').value = distributor._id;
            document.getElementById('editName').value = distributor.name;
            document.getElementById('editPhone').value = distributor.phone;
            document.getElementById('editArea').value = distributor.distributorFields.assignedArea;
            // ... populate other fields
            new bootstrap.Modal(document.getElementById('editDistributorModal')).show();
        })
        .catch(err => {
            console.error('Error:', err);
            alert('Error loading distributor details');
        });
}

function deleteDistributor(id) {
    if (!confirm('Are you sure you want to delete this distributor?')) return;

    fetch(`/admin/distributors/${id}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            window.location.reload();
        } else {
            alert(data.message || 'Error deleting distributor');
        }
    })
    .catch(err => {
        console.error('Error:', err);
        alert('Error deleting distributor');
    });
}
