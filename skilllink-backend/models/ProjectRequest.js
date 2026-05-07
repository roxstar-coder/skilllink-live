const mongoose = require('mongoose');

const ProjectRequestSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  message: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  responseMessage: { type: String, default: '' },
  respondedAt: { type: Date, default: null }
}, { timestamps: true });

ProjectRequestSchema.index({ project: 1, requester: 1, status: 1 });

module.exports = mongoose.model('ProjectRequest', ProjectRequestSchema);
