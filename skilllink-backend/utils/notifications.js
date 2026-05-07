const Notification = require('../models/Notification');

function emitToUser(app, userId, event, payload) {
  const io = app.get('io');
  const userSockets = app.get('userSockets');
  const socketId = userSockets && userSockets.get(String(userId));

  if (io && socketId) {
    io.to(socketId).emit(event, payload);
  }
}

async function notifyUser(req, details) {
  const notification = await Notification.create({
    recipient: details.recipient,
    actor: details.actor || null,
    project: details.project || null,
    projectRequest: details.projectRequest || null,
    type: details.type,
    title: details.title,
    message: details.message,
    link: details.link || ''
  });

  emitToUser(req.app, details.recipient, 'newNotification', {
    id: notification._id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    link: notification.link,
    createdAt: notification.createdAt
  });

  if (details.eventName) {
    emitToUser(req.app, details.recipient, details.eventName, details.eventPayload || {
      message: details.message
    });
  }

  return notification;
}

module.exports = {
  emitToUser,
  notifyUser
};
