const express = require('express');
const User = require('../models/user');
const Post = require('../models/Post');
const Project = require('../models/Project');
const auth = require('../middleware/auth');

const router = express.Router();

async function toggleSavedItem({ req, res, field, targetId, model, disallowSelf = false }) {
  try {
    if (disallowSelf && String(req.user.userId) === String(targetId)) {
      return res.status(400).json({ message: 'You cannot save your own profile here.' });
    }

    const target = await model.findById(targetId);
    if (!target) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const user = await User.findById(req.user.userId).select(field);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentValues = Array.isArray(user[field]) ? user[field].map(value => String(value)) : [];
    const isSaved = currentValues.includes(String(targetId));

    await User.findByIdAndUpdate(req.user.userId, isSaved
      ? { $pull: { [field]: targetId } }
      : { $addToSet: { [field]: targetId } }
    );

    res.json({
      message: isSaved ? 'Removed from saved items' : 'Saved successfully',
      saved: !isSaved
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating saved item', error: error.message });
  }
}

router.post('/posts/:id/toggle', auth, async (req, res) => {
  return toggleSavedItem({ req, res, field: 'savedPosts', targetId: req.params.id, model: Post });
});

router.post('/projects/:id/toggle', auth, async (req, res) => {
  return toggleSavedItem({ req, res, field: 'savedProjects', targetId: req.params.id, model: Project });
});

router.post('/profiles/:id/toggle', auth, async (req, res) => {
  return toggleSavedItem({ req, res, field: 'savedProfiles', targetId: req.params.id, model: User, disallowSelf: true });
});

module.exports = router;
