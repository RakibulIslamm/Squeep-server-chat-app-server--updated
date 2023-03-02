const mongoose = require('mongoose');


const userSchema = mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    username: { type: String, required: true },
    img: { type: String || null },
    coverImg: { type: String || null },
    bio: { type: String }
});

module.exports = mongoose.model("User", userSchema);