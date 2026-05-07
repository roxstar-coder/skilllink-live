const User = require('../models/user');

async function adminMiddleware(req, res, next) {
  try {
    const user = await User.findById(req.user.userId).select('role email');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    req.adminUser = user;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Error checking admin access', error: error.message });
  }
}

module.exports = adminMiddleware;
