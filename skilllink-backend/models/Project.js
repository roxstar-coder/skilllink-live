const mongoose = require('mongoose');

const ProjectMediaSchema = new mongoose.Schema({
  type: { type: String, enum: ['image', 'video'], required: true },
  storageProvider: { type: String, default: 'local' },
  mimeType: { type: String, required: true },
  originalName: { type: String, default: '' },
  size: { type: Number, default: 0 },
  publicId: { type: String, default: '' },
  url: { type: String, required: true }
}, { _id: false });

const ProjectSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  status: { type: String, enum: ['planning', 'active', 'pending', 'completed'], default: 'planning' },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  requiredSkills: { type: [String], default: [] },
  bannerMedia: { type: ProjectMediaSchema, default: null },
  collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }]
}, { timestamps: true });

module.exports = mongoose.model('Project', ProjectSchema);
