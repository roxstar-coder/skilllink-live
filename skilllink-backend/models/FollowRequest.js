const mongoose = require('mongoose');

const FollowRequestSchema = new mongoose.Schema({
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  }
}, { timestamps: true });

FollowRequestSchema.index({ requester: 1, receiver: 1, status: 1 });

module.exports = mongoose.model('FollowRequest', FollowRequestSchema);
