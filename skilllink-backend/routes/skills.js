const express = require('express');
const router = express.Router();
const skillController = require('../controllers/skillController');
const auth = require('../middleware/auth');

router.post('/', auth, skillController.addSkill);
router.get('/', auth, skillController.getSkills);
router.delete('/:id', auth, skillController.deleteSkill);

module.exports = router;
