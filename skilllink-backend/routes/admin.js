const express = require('express');
const User = require('../models/user');
const Post = require('../models/Post');
const Project = require('../models/Project');
const Skill = require('../models/Skill');
const FollowRequest = require('../models/FollowRequest');
const ProjectRequest = require('../models/ProjectRequest');
const Notification = require('../models/Notification');
const { deleteMediaAssets } = require('../storage/mediaStorage');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

router.use(auth, admin);

router.get('/summary', async (req, res) => {
  try {
    const [users, posts, projects, skills, followRequests, projectRequests, notifications] = await Promise.all([
      User.countDocuments(),
      Post.countDocuments(),
      Project.countDocuments(),
      Skill.countDocuments(),
      FollowRequest.countDocuments(),
      ProjectRequest.countDocuments(),
      Notification.countDocuments()
    ]);

    res.json({ users, posts, projects, skills, followRequests, projectRequests, notifications });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching admin summary', error: error.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const users = await User.find()
      .select('-password -loginOtpHash -loginOtpExpiresAt')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { name, email, bio, location, role } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { name, email, bio, location, role } },
      { new: true, runValidators: true }
    ).select('-password -loginOtpHash -loginOtpExpiresAt');

    if (!updatedUser) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User updated', user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: 'Error updating user', error: error.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    if (String(req.user.userId) === String(req.params.id)) {
      return res.status(400).json({ message: 'Admin cannot delete their own account here' });
    }

    const [postsToDelete, projectsToDelete, userToDelete] = await Promise.all([
      Post.find({ user: req.params.id }).select('media'),
      Project.find({ user: req.params.id }).select('bannerMedia'),
      User.findById(req.params.id).select('profilePhoto')
    ]);
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await Promise.all(postsToDelete.map(post => deleteMediaAssets(post.media || [])));
    await Promise.all(projectsToDelete.map(project => deleteMediaAssets(project.bannerMedia ? [project.bannerMedia] : [])));
    if (userToDelete?.profilePhoto) {
      await deleteMediaAssets([userToDelete.profilePhoto]);
    }

    const deletedPostIds = postsToDelete.map(post => post._id);
    const deletedProjectIds = projectsToDelete.map(project => project._id);

    await Promise.all([
      Post.deleteMany({ user: req.params.id }),
      Project.deleteMany({ user: req.params.id }),
      Skill.deleteMany({ user: req.params.id }),
      FollowRequest.deleteMany({
        $or: [{ requester: req.params.id }, { receiver: req.params.id }]
      }),
      ProjectRequest.deleteMany({
        $or: [{ requester: req.params.id }, { owner: req.params.id }]
      }),
      Notification.deleteMany({
        $or: [{ recipient: req.params.id }, { actor: req.params.id }]
      }),
      Project.updateMany({}, {
        $pull: { collaborators: req.params.id }
      }),
      User.updateMany({}, {
        $pull: {
          followers: req.params.id,
          following: req.params.id,
          savedProfiles: req.params.id,
          savedPosts: { $in: deletedPostIds },
          savedProjects: { $in: deletedProjectIds }
        }
      })
    ]);

    res.json({ message: 'User and related data deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
});

router.get('/posts', async (req, res) => {
  try {
    const posts = await Post.find().populate('user', 'name email').sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching posts', error: error.message });
  }
});

router.put('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $set: { content: req.body.content } },
      { new: true, runValidators: true }
    ).populate('user', 'name email');

    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.json({ message: 'Post updated', post });
  } catch (error) {
    res.status(500).json({ message: 'Error updating post', error: error.message });
  }
});

router.delete('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    await deleteMediaAssets(post.media || []);
    await User.updateMany({}, { $pull: { savedPosts: req.params.id } });
    res.json({ message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting post', error: error.message });
  }
});

router.get('/projects', async (req, res) => {
  try {
    const projects = await Project.find().populate('user', 'name email').sort({ createdAt: -1 });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching projects', error: error.message });
  }
});

router.put('/projects/:id', async (req, res) => {
  try {
    const { name, description, status, progress, requiredSkills } = req.body;
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { $set: { name, description, status, progress, requiredSkills } },
      { new: true, runValidators: true }
    ).populate('user', 'name email');

    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json({ message: 'Project updated', project });
  } catch (error) {
    res.status(500).json({ message: 'Error updating project', error: error.message });
  }
});

router.delete('/projects/:id', async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (project.bannerMedia) {
      await deleteMediaAssets([project.bannerMedia]);
    }
    await User.updateMany({}, { $pull: { savedProjects: req.params.id } });
    await Promise.all([
      ProjectRequest.deleteMany({ project: req.params.id }),
      Notification.deleteMany({ project: req.params.id })
    ]);
    res.json({ message: 'Project deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting project', error: error.message });
  }
});

router.get('/skills', async (req, res) => {
  try {
    const skills = await Skill.find().populate('user', 'name email').sort({ createdAt: -1 });
    res.json(skills);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching skills', error: error.message });
  }
});

router.put('/skills/:id', async (req, res) => {
  try {
    const { name, level, description } = req.body;
    const skill = await Skill.findByIdAndUpdate(
      req.params.id,
      { $set: { name, level, description } },
      { new: true, runValidators: true }
    ).populate('user', 'name email');

    if (!skill) return res.status(404).json({ message: 'Skill not found' });
    res.json({ message: 'Skill updated', skill });
  } catch (error) {
    res.status(500).json({ message: 'Error updating skill', error: error.message });
  }
});

router.delete('/skills/:id', async (req, res) => {
  try {
    const skill = await Skill.findByIdAndDelete(req.params.id);
    if (!skill) return res.status(404).json({ message: 'Skill not found' });
    res.json({ message: 'Skill deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting skill', error: error.message });
  }
});

router.get('/follow-requests', async (req, res) => {
  try {
    const requests = await FollowRequest.find()
      .populate('requester', 'name email')
      .populate('receiver', 'name email')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching follow requests', error: error.message });
  }
});

router.put('/follow-requests/:id', async (req, res) => {
  try {
    const followRequest = await FollowRequest.findById(req.params.id);

    if (!followRequest) return res.status(404).json({ message: 'Follow request not found' });

    const previousStatus = followRequest.status;
    followRequest.status = req.body.status;
    await followRequest.save();

    if (followRequest.status === 'accepted' && previousStatus !== 'accepted') {
      await Promise.all([
        User.findByIdAndUpdate(followRequest.requester, {
          $addToSet: { following: followRequest.receiver }
        }),
        User.findByIdAndUpdate(followRequest.receiver, {
          $addToSet: { followers: followRequest.requester }
        })
      ]);
    }

    if (previousStatus === 'accepted' && followRequest.status !== 'accepted') {
      await Promise.all([
        User.findByIdAndUpdate(followRequest.requester, {
          $pull: { following: followRequest.receiver }
        }),
        User.findByIdAndUpdate(followRequest.receiver, {
          $pull: { followers: followRequest.requester }
        })
      ]);
    }

    await followRequest.populate('requester', 'name email');
    await followRequest.populate('receiver', 'name email');
    res.json({ message: 'Follow request updated', followRequest });
  } catch (error) {
    res.status(500).json({ message: 'Error updating follow request', error: error.message });
  }
});

router.delete('/follow-requests/:id', async (req, res) => {
  try {
    const followRequest = await FollowRequest.findByIdAndDelete(req.params.id);
    if (!followRequest) return res.status(404).json({ message: 'Follow request not found' });
    res.json({ message: 'Follow request deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting follow request', error: error.message });
  }
});

module.exports = router;
