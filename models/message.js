const mongoose = require('mongoose');


const messageSchema = mongoose.Schema({
    sender: {
        name: { type: String },
        email: { type: String }
    },
    receiver: {
        name: { type: String },
        email: { type: String }
    },
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation"
    },
    message: { type: String },
    callTime: { type: Object },
    img: { type: String },
    timestamp: { type: Number },
    replyText: { type: String },
    replyImg: { type: String }
});

module.exports = mongoose.model("Message", messageSchema);