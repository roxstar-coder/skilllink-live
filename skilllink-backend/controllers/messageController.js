const Message = require('../models/Message');

exports.sendMessage = async (req, res) => {
    try {
        const { receiver, text } = req.body;
        const sender = req.user.userId;
        const message = new Message({ sender, receiver, text });
        await message.save();

        const io = req.app.get('io');
        const userSockets = req.app.get('userSockets');
        const receiverSocketId = userSockets.get(receiver);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('newMessage', message);
        }

        res.status(201).json({ message: 'Message sent!', data: message });
    } catch (error) {
        console.error('Error in sendMessage:', error);
        res.status(500).json({ message: 'Error sending message', error: error.message });
    }
};

exports.getConversations = async (req, res) => {
    try {
        const user1 = req.user.userId;
        const user2 = req.params.userId;
        const messages = await Message.find({
            $or: [
                { sender: user1, receiver: user2 },
                { sender: user2, receiver: user1 }
            ]
        }).sort({ timestamp: 1 });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching messages', error: error.message });
    }
};
