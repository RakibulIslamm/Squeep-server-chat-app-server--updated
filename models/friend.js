const mongoose = require('mongoose');


const friendSchema = mongoose.Schema({
    friendship: [{ type: String }],
    users: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    status: { type: String },
    requester: { type: String },
    receiver: { type: String },
    conversationId: { type: mongoose.Schema.Types.ObjectId },
    timestamp: { type: Number },
});

module.exports = mongoose.model("Friend", friendSchema);