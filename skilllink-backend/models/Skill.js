const mongoose = require('mongoose');

const SkillSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  name: { type: String, required: true },
  level: { type: Number, required: true, min: 1, max: 5 },
  description: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Skill', SkillSchema);
