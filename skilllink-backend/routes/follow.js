const express = require('express');
const User = require('../models/user');
const FollowRequest = require('../models/FollowRequest');
const auth = require('../middleware/auth');
const { notifyUser } = require('../utils/notifications');

const router = express.Router();

router.get('/contacts', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .populate('followers', 'name email bio location profilePhoto')
      .populate('following', 'name email bio location profilePhoto');

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      followers: user.followers || [],
      following: user.following || []
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching contacts', error: error.message });
  }
});

router.get('/requests', auth, async (req, res) => {
  try {
    const incoming = await FollowRequest.find({
      receiver: req.user.userId,
      status: 'pending'
    }).populate('requester', 'name email bio location profilePhoto').sort({ createdAt: -1 });

    const outgoing = await FollowRequest.find({
      requester: req.user.userId,
      status: 'pending'
    }).populate('receiver', 'name email bio location profilePhoto').sort({ createdAt: -1 });

    res.json({ incoming, outgoing });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching follow requests', error: error.message });
  }
});

router.post('/request', auth, async (req, res) => {
  try {
    const requesterId = req.user.userId;
    const { targetId } = req.body;

    if (!targetId) return res.status(400).json({ message: 'Target user is required' });
    if (String(requesterId) === String(targetId)) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    const [requester, target] = await Promise.all([
      User.findById(requesterId),
      User.findById(targetId)
    ]);

    if (!requester || !target) return res.status(404).json({ message: 'User not found' });
    if (requester.following.some(id => String(id) === String(targetId))) {
      return res.status(400).json({ message: 'You are already following this user' });
    }

    const existingPending = await FollowRequest.findOne({
      requester: requesterId,
      receiver: targetId,
      status: 'pending'
    });

    if (existingPending) {
      return res.status(400).json({ message: 'Follow request already sent' });
    }

    const followRequest = await FollowRequest.create({
      requester: requesterId,
      receiver: targetId
    });
    await followRequest.populate('requester', 'name email bio location profilePhoto');

    await notifyUser(req, {
      recipient: targetId,
      actor: requesterId,
      type: 'follow_request_received',
      title: 'New follow request',
      message: `${requester.name} requested to follow you.`,
      link: 'messages',
      eventName: 'followRequest',
      eventPayload: {
        message: `${requester.name} requested to follow you.`,
        request: followRequest
      }
    });

    res.status(201).json({ message: 'Follow request sent', request: followRequest });
  } catch (error) {
    res.status(500).json({ message: 'Error sending follow request', error: error.message });
  }
});

router.post('/accept', auth, async (req, res) => {
  try {
    const { requestId } = req.body;
    const followRequest = await FollowRequest.findOne({
      _id: requestId,
      receiver: req.user.userId,
      status: 'pending'
    }).populate('requester', 'name email bio location profilePhoto').populate('receiver', 'name email bio location profilePhoto');

    if (!followRequest) return res.status(404).json({ message: 'Follow request not found' });

    await Promise.all([
      User.findByIdAndUpdate(followRequest.requester._id, {
        $addToSet: { following: followRequest.receiver._id }
      }),
      User.findByIdAndUpdate(followRequest.receiver._id, {
        $addToSet: { followers: followRequest.requester._id }
      })
    ]);

    followRequest.status = 'accepted';
    await followRequest.save();

    await notifyUser(req, {
      recipient: followRequest.requester._id,
      actor: followRequest.receiver._id,
      type: 'follow_request_accepted',
      title: 'Follow request accepted',
      message: `${followRequest.receiver.name} accepted your follow request.`,
      link: 'messages',
      eventName: 'followAccepted',
      eventPayload: {
        message: `${followRequest.receiver.name} accepted your follow request.`,
        user: followRequest.receiver
      }
    });

    res.json({ message: 'Follow request accepted', request: followRequest });
  } catch (error) {
    res.status(500).json({ message: 'Error accepting follow request', error: error.message });
  }
});

router.post('/reject', auth, async (req, res) => {
  try {
    const { requestId } = req.body;
    const followRequest = await FollowRequest.findOne({
      _id: requestId,
      receiver: req.user.userId,
      status: 'pending'
    });

    if (!followRequest) return res.status(404).json({ message: 'Follow request not found' });

    followRequest.status = 'rejected';
    await followRequest.save();

    res.json({ message: 'Follow request rejected' });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting follow request', error: error.message });
  }
});

router.post('/unfollow', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { targetId } = req.body;
    await User.findByIdAndUpdate(userId, { $pull: { following: targetId } });
    await User.findByIdAndUpdate(targetId, { $pull: { followers: userId } });
    res.json({ message: 'Unfollowed' });
  } catch (error) {
    res.status(500).json({ message: 'Error unfollowing user', error: error.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('followers', 'name email')
      .populate('following', 'name email');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile', error: error.message });
  }
});

module.exports = router;
