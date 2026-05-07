const User = require('../models/user');
const Project = require('../models/Project');
const Skill = require('../models/Skill');
const Viewer = require('../models/user');

exports.getDiscoveryData = async (req, res) => {
    try {
        const userId = req.user.userId;
        const viewer = await Viewer.findById(userId).select('savedProfiles savedProjects');
        const savedProfileIds = new Set((viewer?.savedProfiles || []).map(id => String(id)));
        const savedProjectIds = new Set((viewer?.savedProjects || []).map(id => String(id)));

        // 1. Get current user's skills
        const userSkills = await Skill.find({ user: userId });
        const skillNames = userSkills.map(s => s.name.toLowerCase());

        if (skillNames.length === 0) {
            return res.json({
                recommendedUsers: [],
                recommendedProjects: [],
                message: "Add some skills to get better recommendations!"
            });
        }

        // 2. Find other users with overlapping skills
        // We find skills that match the user's skill names, excluding the current user
        const matchingSkills = await Skill.find({
            user: { $ne: userId },
            name: { $in: skillNames.map(name => new RegExp(`^${name}$`, 'i')) }
        }).populate('user', 'name email bio location profilePhoto');

        // Group by user and count matches
        const userMap = new Map();
        matchingSkills.forEach(skill => {
            if (!skill.user) return;
            const uId = skill.user._id.toString();
            if (!userMap.has(uId)) {
                userMap.set(uId, {
                    user: skill.user,
                    matchingSkills: [],
                    matchCount: 0
                });
            }
            const userData = userMap.get(uId);
            userData.matchingSkills.push(skill.name);
            userData.matchCount++;
        });

        const recommendedUsers = Array.from(userMap.values())
            .map(item => ({
                ...item,
                user: {
                    ...item.user.toObject(),
                    isSaved: savedProfileIds.has(String(item.user._id))
                }
            }))
            .sort((a, b) => b.matchCount - a.matchCount)
            .slice(0, 10);

        // 3. Find projects requiring these skills
        const recommendedProjects = await Project.find({
            user: { $ne: userId },
            requiredSkills: { $in: skillNames.map(name => new RegExp(`^${name}$`, 'i')) }
        }).populate('user', 'name profilePhoto');

        res.json({
            recommendedUsers,
            recommendedProjects: recommendedProjects.map(project => ({
                ...project.toObject(),
                isSaved: savedProjectIds.has(String(project._id))
            }))
        });
    } catch (error) {
        console.error('Discovery Error:', error);
        res.status(500).json({ message: 'Error fetching discovery data', error: error.message });
    }
};
