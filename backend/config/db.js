const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Abhi database URL hum baad me .env me daalenge
        const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:2017/chat-app');
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;