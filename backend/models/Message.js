const mongoose = require('mongoose');

const messageSchema = mongoose.Schema(
    {
        sender: { type: String, required: true },
        content: { type: String, required: true },
        timestamp: { type: String, required: true }
    },
    { timestamps: true }
);

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;