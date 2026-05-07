const User = require('../models/user');
const Post = require('../models/Post');
const Project = require('../models/Project');
const Skill = require('../models/Skill');
const { saveMediaAsset, deleteMediaAssets } = require('../storage/mediaStorage');

exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching profile', error: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { bio, location, name, profilePhoto } = req.body;
        const updateData = {};
        if (bio !== undefined) updateData.bio = bio;
        if (location !== undefined) updateData.location = location;
        if (name !== undefined) updateData.name = name;
        const existingUser = await User.findById(req.user.userId).select('-password');
        if (!existingUser) return res.status(404).json({ message: 'User not found' });

        if (profilePhoto) {
            const savedProfilePhoto = await saveMediaAsset(profilePhoto, {
                folder: 'profiles',
                allowedTypes: ['image']
            });
            if (existingUser.profilePhoto) {
                await deleteMediaAssets([existingUser.profilePhoto]);
            }
            updateData.profilePhoto = savedProfilePhoto;
        }

        const updatedUser = await User.findByIdAndUpdate(req.user.userId, { $set: updateData }, { new: true }).select('-password');

        res.json({ message: 'Profile updated', user: updatedUser });
    } catch (error) {
        res.status(500).json({ message: 'Error updating profile', error: error.message });
    }
};

exports.getBookmarks = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .populate({
                path: 'savedPosts',
                populate: [
                    { path: 'user', select: 'name email profilePhoto' },
                    { path: 'comments.user', select: 'name email profilePhoto' }
                ],
                options: { sort: { createdAt: -1 } }
            })
            .populate({
                path: 'savedProjects',
                populate: { path: 'user', select: 'name email profilePhoto' },
                options: { sort: { createdAt: -1 } }
            })
            .populate({
                path: 'savedProfiles',
                select: 'name email bio location profilePhoto followers following createdAt',
                options: { sort: { createdAt: -1 } }
            })
            .select('savedPosts savedProjects savedProfiles');

        if (!user) return res.status(404).json({ message: 'User not found' });

        const profileIds = new Set((user.savedProfiles || []).map(profile => String(profile._id)));
        const projectIds = new Set((user.savedProjects || []).map(project => String(project._id)));
        const postIds = new Set((user.savedPosts || []).map(post => String(post._id)));

        const profileSkills = await Skill.find({
            user: { $in: Array.from(profileIds) }
        }).select('user name level').sort({ createdAt: -1 });

        const skillsByProfile = new Map();
        profileSkills.forEach(skill => {
            const id = String(skill.user);
            if (!skillsByProfile.has(id)) skillsByProfile.set(id, []);
            skillsByProfile.get(id).push({ name: skill.name, level: skill.level });
        });

        const serializedPosts = (user.savedPosts || []).map(post => {
            const raw = typeof post.toObject === 'function' ? post.toObject() : { ...post };
            raw.likeCount = (raw.likes || []).length;
            raw.commentCount = (raw.comments || []).length;
            raw.hasLiked = (raw.likes || []).some(id => String(id) === String(req.user.userId));
            raw.isSaved = postIds.has(String(raw._id));
            return raw;
        });

        const serializedProjects = (user.savedProjects || []).map(project => ({
            ...(typeof project.toObject === 'function' ? project.toObject() : { ...project }),
            isSaved: projectIds.has(String(project._id))
        }));

        const serializedProfiles = (user.savedProfiles || []).map(profile => ({
            _id: profile._id,
            name: profile.name,
            email: profile.email,
            bio: profile.bio,
            location: profile.location,
            profilePhoto: profile.profilePhoto || null,
            followersCount: (profile.followers || []).length,
            followingCount: (profile.following || []).length,
            joinedAt: profile.createdAt,
            relationship: 'saved',
            isSaved: profileIds.has(String(profile._id)),
            skills: skillsByProfile.get(String(profile._id)) || []
        }));

        res.json({
            posts: serializedPosts,
            projects: serializedProjects,
            profiles: serializedProfiles
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching bookmarks', error: error.message });
    }
};
