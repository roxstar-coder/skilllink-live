const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  projectRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectRequest', default: null },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  link: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);
