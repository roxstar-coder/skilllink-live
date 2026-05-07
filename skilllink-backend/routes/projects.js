const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const auth = require('../middleware/auth');

router.post('/', auth, projectController.createProject);
router.get('/', auth, projectController.getProjects);
router.get('/requests', auth, projectController.getProjectRequests);
router.post('/:id/request-join', auth, projectController.requestToJoinProject);
router.post('/requests/:requestId/respond', auth, projectController.respondToProjectRequest);
router.put('/:id', auth, projectController.updateProject);
router.delete('/:id', auth, projectController.deleteProject);

module.exports = router;
