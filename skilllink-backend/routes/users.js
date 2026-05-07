const express = require('express');
const User = require('../models/user');
const Skill = require('../models/Skill');
const Project = require('../models/Project');
const FollowRequest = require('../models/FollowRequest');
const auth = require('../middleware/auth');

const router = express.Router();

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getRelationship(currentUserId, targetUser) {
  const targetId = targetUser._id;

  if (targetUser.followers.some(id => String(id) === String(currentUserId))) {
    return 'following';
  }

  const pending = await FollowRequest.findOne({
    status: 'pending',
    $or: [
      { requester: currentUserId, receiver: targetId },
      { requester: targetId, receiver: currentUserId }
    ]
  });

  if (!pending) return 'none';
  return String(pending.requester) === String(currentUserId) ? 'pending' : 'incoming';
}

router.get('/search', auth, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json([]);

    const term = new RegExp(escapeRegex(q), 'i');
    const skillMatches = await Skill.find({ name: term }).select('user').limit(50);
    const skillUserIds = skillMatches.map(skill => skill.user);

    const viewer = await User.findById(req.user.userId).select('savedProfiles');
    const savedProfileIds = new Set((viewer?.savedProfiles || []).map(id => String(id)));

    const users = await User.find({
      _id: { $ne: req.user.userId },
      $or: [
        { name: term },
        { email: term },
        { location: term },
        { _id: { $in: skillUserIds } }
      ]
    }).select('name email bio location profilePhoto followers following').limit(20);

    const userIds = users.map(user => user._id);
    const skills = await Skill.find({ user: { $in: userIds } }).select('user name level');

    const skillsByUser = new Map();
    skills.forEach(skill => {
      const id = String(skill.user);
      if (!skillsByUser.has(id)) skillsByUser.set(id, []);
      skillsByUser.get(id).push({ name: skill.name, level: skill.level });
    });

    const results = await Promise.all(users.map(async user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      bio: user.bio,
      location: user.location,
      profilePhoto: user.profilePhoto || null,
      followersCount: user.followers.length,
      followingCount: user.following.length,
      isSaved: savedProfileIds.has(String(user._id)),
      relationship: await getRelationship(req.user.userId, user),
      skills: skillsByUser.get(String(user._id)) || []
    })));

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Error searching users', error: error.message });
  }
});

router.get('/:id/public', auth, async (req, res) => {
  try {
    const [user, viewer] = await Promise.all([
      User.findById(req.params.id).select('name email bio location profilePhoto followers following createdAt'),
      User.findById(req.user.userId).select('savedProfiles savedProjects')
    ]);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const savedProjectIds = new Set((viewer?.savedProjects || []).map(id => String(id)));

    const [skills, projects, relationship] = await Promise.all([
      Skill.find({ user: user._id }).sort({ createdAt: -1 }),
      Project.find({ user: user._id }).sort({ createdAt: -1 }),
      getRelationship(req.user.userId, user)
    ]);

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        location: user.location,
        profilePhoto: user.profilePhoto || null,
        followersCount: user.followers.length,
        followingCount: user.following.length,
        joinedAt: user.createdAt,
        isSaved: (viewer?.savedProfiles || []).some(id => String(id) === String(user._id))
      },
      skills,
      projects: projects.map(project => ({
        ...project.toObject(),
        isSaved: savedProjectIds.has(String(project._id))
      })),
      relationship
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching public profile', error: error.message });
  }
});

module.exports = router;
