const mongoose = require('mongoose');


const conversationSchema = new mongoose.Schema({
    users: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    participants: [{ type: String }],
    sender: { type: String },
    lastMessage: { type: String },
    unseenMessages: { type: Number },
    timestamp: { type: Number },
    isFriend: { type: Boolean },
    img: { type: Boolean },
    lastSeen: {
        message: { type: String },
        timestamp: { type: Number },
    },
    delivered: {
        messageDelivered: { type: Boolean },
        timestamp: { type: Number }
    },
    sent: {
        messageSent: { type: Boolean },
        timestamp: { type: Number }
    }
});

module.exports = mongoose.model("Conversation", conversationSchema);