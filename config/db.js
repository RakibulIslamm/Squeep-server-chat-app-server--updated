const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect('mongodb://127.0.0.1:27017/chat-db');
        console.log(`Mongodb Connected: ${conn.connection.host}`.bgCyan.underline)
    }
    catch (e) {
        console.log(e.message)
    }
}

module.exports = connectDB;