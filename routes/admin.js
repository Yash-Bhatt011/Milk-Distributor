const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Protect all admin routes
router.use(isAuthenticated, isAdmin);

// Dashboard routes with both paths
router.get('/', adminController.getDashboard);
router.get('/dashboard', adminController.getDashboard);
router.get('/dashboard/stats', adminController.getDashboardStats);

// Customer management routes
router.get('/customers', adminController.getCustomers);
router.get('/customers/:id', adminController.getCustomerDetails);
router.put('/customers/:id', adminController.updateCustomer);

// Distributor management
router.get('/distributors', adminController.getDistributors);
router.post('/distributors', adminController.createDistributor);
router.get('/distributors/:id', adminController.getDistributorDetails);
router.put('/distributors/:id', adminController.updateDistributor);
router.delete('/distributors/:id', adminController.deleteDistributor);

// Reports routes
router.get('/reports', adminController.getReports);
router.get('/reports/revenue', adminController.getRevenueReport);
router.get('/reports/revenue/data', adminController.getRevenueData);
router.get('/reports/deliveries', adminController.getDeliveryReport);
router.get('/reports/deliveries/data', adminController.getDeliveryStats);

// Payment summary route
router.get('/payment-summary', async (req, res) => {
    try {
        const [payments, orders] = await Promise.all([
            Payment.aggregate([
                {
                    $group: {
                        _id: null,
                        totalCollections: { $sum: '$amount' },
                        count: { $sum: 1 }
                    }
                }
            ]),
            Order.aggregate([
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$totalAmount' }
                    }
                }
            ])
        ]);

        const totalCollections = payments[0]?.totalCollections || 0;
        const totalRevenue = orders[0]?.totalRevenue || 0;
        const totalOutstanding = totalRevenue - totalCollections;
        const averageCollection = payments[0]?.count ? totalCollections / payments[0].count : 0;
        const collectionRate = totalRevenue ? (totalCollections / totalRevenue * 100).toFixed(1) : 0;

        res.json({
            totalCollections,
            totalOutstanding,
            averageCollection,
            collectionRate
        });
    } catch (err) {
        console.error('Error fetching payment summary:', err);
        res.status(500).json({ error: 'Failed to fetch payment summary' });
    }
});

module.exports = router;
