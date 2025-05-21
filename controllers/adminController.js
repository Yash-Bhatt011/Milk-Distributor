const mongoose = require('mongoose');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Delivery = require('../models/Delivery');

exports.getDashboard = async (req, res) => {
    try {
        const stats = {
            distributorCount: await User.countDocuments({ role: 'distributor' }),
            customerCount: await User.countDocuments({ role: 'customer' }),
            monthlyRevenue: await calculateMonthlyRevenue()
        };

        const recentCustomers = await User.find({ role: 'customer' })
            .populate('customerFields.distributorId', 'name')
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            stats,
            recentCustomers
        });
    } catch (err) {
        console.error('Dashboard Error:', err);
        req.flash('error_msg', 'Error loading dashboard');
        res.redirect('/');
    }
};

exports.getDashboardStats = async (req, res) => {
    try {
        const stats = {
            distributorCount: await User.countDocuments({ role: 'distributor' }),
            customerCount: await User.countDocuments({ role: 'customer' }),
            monthlyRevenue: await calculateMonthlyRevenue()
        };
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching dashboard stats' });
    }
};

exports.getCustomers = async (req, res) => {
    try {
        const customers = await User.find({ role: 'customer' })
            .populate('customerFields.distributorId', 'name')
            .lean();
        res.render('admin/customers', { customers });
    } catch (err) {
        req.flash('error_msg', 'Error loading customers');
        res.redirect('/admin/dashboard');
    }
};

exports.getCustomerDetails = async (req, res) => {
    try {
        const customer = await User.findById(req.params.id)
            .populate('customerFields.distributorId')
            .lean();
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        res.json(customer);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching customer details' });
    }
};

exports.updateCustomer = async (req, res) => {
    try {
        const customer = await User.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );
        res.json({ success: true, customer });
    } catch (err) {
        res.status(500).json({ message: 'Error updating customer' });
    }
};

exports.getDistributors = async (req, res) => {
    try {
        const distributors = await User.find({ role: 'distributor' }).lean();
        res.render('admin/distributors', { distributors });
    } catch (err) {
        req.flash('error_msg', 'Error loading distributors');
        res.redirect('/admin/dashboard');
    }
};

exports.createDistributor = async (req, res) => {
    try {
        const distributor = new User({
            ...req.body,
            role: 'distributor'
        });
        await distributor.save();
        res.json({ success: true, distributor });
    } catch (err) {
        res.status(500).json({ message: 'Error creating distributor' });
    }
};

exports.getDistributorDetails = async (req, res) => {
    try {
        const distributor = await User.findById(req.params.id).lean();
        if (!distributor) {
            return res.status(404).json({ message: 'Distributor not found' });
        }
        res.json(distributor);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching distributor details' });
    }
};

exports.updateDistributor = async (req, res) => {
    try {
        const distributor = await User.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );
        res.json({ success: true, distributor });
    } catch (err) {
        res.status(500).json({ message: 'Error updating distributor' });
    }
};

exports.deleteDistributor = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Distributor deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting distributor' });
    }
};

exports.getReports = async (req, res) => {
    try {
        // Step 1: Get all distributors
        const distributors = await User.find({ role: 'distributor' });

        const distributorStats = await Promise.all(distributors.map(async (distributor) => {
            // Get customers for this distributor
            const customers = await User.find({
                'customerFields.distributorId': distributor._id
            });

            const activeCustomers = customers.filter(c => c.customerFields?.active).length;

            // Get deliveries for this distributor
            const deliveries = await Delivery.find({ distributor: distributor._id });

            const deliveryCount = deliveries.length;
            const deliveredCount = deliveries.filter(d => d.status === 'delivered').length;
            const successRate = deliveryCount === 0 ? 0 : (deliveredCount / deliveryCount) * 100;

            const totalRevenue = deliveries.reduce((sum, d) => sum + (d.amount || 0), 0);
            const outstandingAmount = deliveries.reduce((sum, d) => {
                return d.status === 'pending' ? sum + (d.amount || 0) : sum;
            }, 0);

            return {
                name: distributor.name,
                activeCustomers,
                deliveryCount,
                successRate,
                totalRevenue,
                outstandingAmount
            };
        }));


        // Step 4: Build summary
        const summary = {
            totalCollections: distributorStats.reduce((sum, d) => sum + d.totalRevenue, 0),
            totalOutstanding: distributorStats.reduce((sum, d) => sum + d.outstandingAmount, 0),
            averageCollection: 0,
            collectionRate: 0
        };

        if (distributorStats.length > 0) {
            summary.averageCollection = Math.round(summary.totalCollections / distributorStats.length);
            summary.collectionRate = Math.round(
                (summary.totalCollections * 100) /
                (summary.totalCollections + summary.totalOutstanding || 1)
            );
        }

        res.render('admin/reports', {
            title: 'Business Reports',
            distributorStats,
            summary
        });
    } catch (err) {
        console.error('Error generating reports:', err);
        req.flash('error_msg', 'Error loading reports');
        res.redirect('/admin/dashboard');
    }
};


exports.getRevenueReport = async (req, res) => {
    try {
        // Set today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Calculate today's revenue
        const todayData = await Payment.aggregate([
            {
                $match: {
                    status: 'completed',
                    paymentDate: {
                        $gte: today,
                        $lt: tomorrow
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Calculate monthly revenue
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

        const monthlyData = await Payment.aggregate([
            {
                $match: {
                    status: 'completed',
                    paymentDate: {
                        $gte: monthStart,
                        $lte: monthEnd
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Calculate total stats
        const totalData = await Payment.aggregate([
            {
                $match: {
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                    avgAmount: { $avg: '$amount' },
                    maxAmount: { $max: '$amount' },
                    minAmount: { $min: '$amount' }
                }
            }
        ]);

        // Get recent payments
        const payments = await Payment.find()
            .populate('distributor', 'name')
            .sort({ paymentDate: -1 })
            .limit(50);

        const stats = {
            todayRevenue: todayData[0]?.total || 0,
            todayCount: todayData[0]?.count || 0,
            monthlyRevenue: monthlyData[0]?.total || 0,
            monthlyCount: monthlyData[0]?.count || 0,
            totalRevenue: totalData[0]?.total || 0,
            totalCount: totalData[0]?.count || 0,
            averagePayment: totalData[0]?.avgAmount || 0,
            highestPayment: totalData[0]?.maxAmount || 0,
            lowestPayment: totalData[0]?.minAmount || 0
        };

        console.log('Revenue stats:', stats); // For debugging

        res.render('admin/revenue', {
            title: 'Revenue Report',
            stats,
            payments,
            startDate: monthStart.toISOString().split('T')[0],
            endDate: today.toISOString().split('T')[0]
        });

    } catch (err) {
        console.error('Error loading revenue:', err);
        req.flash('error_msg', 'Error loading revenue data');
        res.redirect('/admin/dashboard');
    }
};

exports.getRevenueData = async (req, res) => {
    try {
        const data = await calculateRevenueData(req.query);
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching revenue data' });
    }
};

exports.getDeliveryReport = async (req, res) => {
    try {
        const deliveries = await calculateDeliveryReport();
        res.json(deliveries);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching delivery report' });
    }
};

exports.getDeliveryStats = async (req, res) => {
    try {
        const stats = await calculateDeliveryStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching delivery stats' });
    }
};

// Helper functions
async function calculateMonthlyRevenue() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    const result = await Payment.aggregate([
        {
            $match: {
                status: 'completed',
                paymentDate: {
                    $gte: firstDay,
                    $lte: lastDay
                }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$amount' }
            }
        }
    ]);

    return result[0]?.total || 0;
}

async function calculateRevenueData(query) {
    const { startDate, endDate } = query;
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return await Payment.aggregate([
        {
            $match: {
                paymentDate: { $gte: start, $lte: end }
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: 'distributor',
                foreignField: '_id',
                as: 'distributorInfo'
            }
        },
        {
            $unwind: '$distributorInfo'
        },
        {
            $group: {
                _id: {
                    date: { $dateToString: { format: '%Y-%m-%d', date: '$paymentDate' } },
                    distributor: '$distributorInfo.name'
                },
                completed: {
                    $sum: {
                        $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0]
                    }
                },
                pending: {
                    $sum: {
                        $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0]
                    }
                },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: '$_id.date',
                distributors: {
                    $push: {
                        name: '$_id.distributor',
                        completed: '$completed',
                        pending: '$pending',
                        count: '$count'
                    }
                },
                totalCompleted: { $sum: '$completed' },
                totalPending: { $sum: '$pending' }
            }
        },
        { $sort: { _id: 1 } }
    ]);
}

async function calculateDeliveryStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await Delivery.aggregate([
        {
            $match: {
                scheduledDate: { $gte: today }
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: 'distributor',
                foreignField: '_id',
                as: 'distributorInfo'
            }
        },
        {
            $unwind: '$distributorInfo'
        },
        {
            $group: {
                _id: {
                    distributor: '$distributorInfo.name',
                    status: '$status'
                },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: '$_id.distributor',
                statuses: {
                    $push: {
                        status: '$_id.status',
                        count: '$count'
                    }
                },
                totalDeliveries: { $sum: '$count' }
            }
        }
    ]);
}

async function calculateReportStats() {
    // Add implementation
    return {};
}

async function calculateRevenueReport() {
    // Add implementation
    return {};
}

async function calculateDeliveryReport() {
    // Add implementation
    return [];
}
