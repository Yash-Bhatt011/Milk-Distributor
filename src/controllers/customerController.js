// ... existing code ...

// This is likely where the issue is occurring
exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params; // or req.body
    const updateData = req.body;
    
    const customer = await Customer.findById(id);
    
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }
    
    // Update customer logic
    const updatedCustomer = await Customer.findByIdAndUpdate(id, updateData, { new: true });
    
    res.status(200).json(updatedCustomer);
  } catch (error) {
    console.error("Error updating customer:", error);
    res.status(500).json({ message: "Error updating customer", error: error.message });
  }
}

// ... existing code ...