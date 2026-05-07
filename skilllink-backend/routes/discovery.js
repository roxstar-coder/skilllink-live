const express = require('express');
const router = express.Router();
const discoveryController = require('../controllers/discoveryController');
const auth = require('../middleware/auth');

router.get('/', auth, discoveryController.getDiscoveryData);

module.exports = router;
