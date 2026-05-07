const Skill = require('../models/Skill');

exports.addSkill = async (req, res) => {
    try {
        const { name, level, description } = req.body;
        const newSkill = new Skill({
            user: req.user.userId,
            name,
            level,
            description
        });
        await newSkill.save();
        res.status(201).json({ message: 'Skill added', skill: newSkill });
    } catch (error) {
        res.status(500).json({ message: 'Error adding skill', error: error.message });
    }
};

exports.getSkills = async (req, res) => {
    try {
        const skills = await Skill.find({ user: req.user.userId }).sort({ createdAt: -1 });
        res.json(skills);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching skills', error: error.message });
    }
};

exports.deleteSkill = async (req, res) => {
    try {
        const skill = await Skill.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
        if (!skill) return res.status(404).json({ message: 'Skill not found' });
        res.json({ message: 'Skill deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting skill', error: error.message });
    }
};
