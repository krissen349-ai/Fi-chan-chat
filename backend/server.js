// 🚀 SERVER-SIDE (app.js) - UPDATED CODE
// ==========================================
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Google DNS forced for SRV resolution

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer'); // 👈 Added nodemailer for sending emails

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, { 
    cors: { origin: "*" },
    maxHttpBufferSize: 6 * 1024 * 1024
});

// 🍃 MongoDB Connection Setup
const MONGO_URI = "mongodb+srv://krissen349_db_user:KrisApp12345@cluster0.csj7rim.mongodb.net/giftsDB?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000
})
  .then(() => console.log("✅ MongoDB Connected Successfully! 🍃"))
  .catch((err) => console.log("❌ DB Connection Error:", err.message));

// Prevent crashes on unhandled errors
process.on('unhandledRejection', (reason) => {
    console.log('⚠️ Unhandled Rejection:', reason.message || reason);
});

// 📧 Nodemailer Transporter Configuration (Using standard Gmail SMTP or fallback service)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'fichanchat@gmail.com', // Replace with active notification email if needed
        pass: 'your_email_app_password' // Secure app password
    }
});

// 🎁 Mongoose Schema & Model (Removed unlockDate and unlockTime as requested)
const giftSchema = new mongoose.Schema({
  senderName: { type: String, required: true },
  receiverName: { type: String, required: true },
  recipientEmail: { type: String, default: "" }, // 👈 Added recipient email field
  giftUrl: { type: String, required: true },
  password: { type: String, default: "" }, 
  enableBalloonGame: { type: Boolean, default: true },
  targetAge: { type: Number, default: 21 },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Gift = mongoose.model('Gift', giftSchema);

// In-Memory Storage
let users = {}; 
let groups = [ { id: "global-group", name: "Global Group", description: "Active Session Stream", createdBy: "System" } ];
let messages = {}; 

// 🔌 Socket.IO Event Handlers
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Initial load gifts for the connected user
    Gift.find()
        .then(gifts => socket.emit('update_gifts', gifts))
        .catch(err => console.error("Error fetching initial gifts:", err.message));

    // User Login
    socket.on('login_user', async (userData) => {
        users[socket.id] = { ...userData, id: socket.id, online: true };
        
        if (userData.uid) {
            socket.join(userData.uid);
        }

        io.emit('update_users', Object.values(users));
        io.emit('update_groups', groups);
        
        // 🔔 Notification: When user comes online, broadcast notification directly to clients/mobile apps
        io.emit('push_notification', {
            type: 'USER_ONLINE',
            title: 'User Online ✨',
            message: `@${userData.username || 'Someone'} is now online!`
        });

        try {
            const gifts = await Gift.find();
            io.emit('update_gifts', gifts);
        } catch (err) {
            console.error("Error fetching gifts on login:", err.message);
        }
    });

    // 🎁 Add Gift Handler with Email Notification & Mobile Push Alert
    socket.on('add_gift', async (giftData) => {
        console.log("👉 Step 1: add_gift socket event trigger hua:", giftData);
        
        if (!giftData || !giftData.senderName || !giftData.receiverName || !giftData.giftUrl) {
            console.log("❌ Missing fields in giftData!");
            return;
        }

        try {
            const giftObj = {
                senderName: String(giftData.senderName).trim(),
                receiverName: String(giftData.receiverName).trim(),
                recipientEmail: String(giftData.recipientEmail || "").trim(),
                giftUrl: String(giftData.giftUrl).trim(),
                password: String(giftData.password || "").trim(),
                enableBalloonGame: giftData.enableBalloonGame !== false,
                targetAge: Number(giftData.targetAge) || 21,
                createdBy: String(giftData.createdBy || socket.id)
            };

            const createdGift = await Gift.create(giftObj);
            console.log("✅ Step 2: Database me save hogya! ID:", createdGift._id);

            // ✉️ Send Email to the recipient in English as requested
            if (giftObj.recipientEmail) {
                const mailOptions = {
                    from: 'fichanchat@gmail.com',
                    to: giftObj.recipientEmail,
                    subject: `🎁 You received a special gift from ${giftObj.senderName}!`,
                    text: `Hello ${giftObj.receiverName},\n\n${giftObj.senderName} has sent you a special gift!\n\nHere is your password to access it: ${giftObj.password || 'No password required'}\n\nEnjoy your surprise!`
                };

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.log('❌ Email sending failed:', error.message);
                    } else {
                        console.log('✅ Gift notification email sent:', info.response);
                    }
                });
            }

            // 🔔 Push Notification to mobile / connected clients that a new gift was added
            io.emit('push_notification', {
                type: 'NEW_GIFT',
                title: 'New Gift Added! 🎁',
                message: `${giftObj.senderName} sent a gift to ${giftObj.receiverName}!`
            });

            const allGifts = await Gift.find().sort({ createdAt: -1 });
            io.emit('update_gifts', allGifts);
            console.log("🚀 Step 3: All clients ko update_gifts broadcast kar diya!");
        } catch (err) {
            console.error("❌ ERROR inside add_gift:", err);
        }
    });

    // 🎁 Delete Gift Handler
    socket.on('delete_gift', async ({ giftId, userId }) => {
        try {
            console.log("🗑️ Delete requested for ID:", giftId);
            await Gift.findByIdAndDelete(giftId);
            const updatedGifts = await Gift.find().sort({ createdAt: -1 });
            io.emit('update_gifts', updatedGifts);
        } catch (err) {
            console.error("❌ Delete Error:", err.message);
        }
    });

    // 🎁 Manual Get Gifts
    socket.on('get_gifts', async () => {
        try {
            const gifts = await Gift.find();
            socket.emit('update_gifts', gifts);
        } catch (err) {
            console.error("Error fetching gifts:", err.message);
        }
    });

    // 💬 Chat Logic
    socket.on('join_chat', (chatId) => {
        socket.join(chatId);
        if (messages[chatId]) {
            socket.emit('messages_updated', { chatId, messages: messages[chatId] });
        }
    });

  
    socket.on('send_message', (data) => {
    if (!messages[data.chatId]) messages[data.chatId] = [];
    
    // Yahan ensure karein ki data hamesha existing users se aaye
    const sender = users[socket.id] || { username: data.senderName || "User", pfp: data.pfp };

    const msgObject = {
        id: data.id || `msg-${Date.now()}`, 
        senderId: data.senderId,
        senderName: sender.username, // Yahan backend se confirm ho raha hai
        pfp: sender.pfp || data.pfp, // Backend se pfp le raha hai
        text: data.text || "",
            image: data.image || null,
            fileUrl: data.fileUrl || null,   
            fileType: data.fileType || null, 
            replyTo: data.replyTo || null, 
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            seenBy: [data.senderId],
            reactions: {} 
        };
        
        messages[data.chatId].push(msgObject);
        io.to(data.chatId).emit('receive_message', { chatId: data.chatId, message: msgObject });

        if (data.chatId.includes('--')) {
            data.chatId.split('--').forEach(uid => {
                io.to(uid).emit('receive_message', { chatId: data.chatId, message: msgObject });
            });
        }
    });

    socket.on('react_message', ({ chatId, messageId, userId, emoji }) => {
        if (messages[chatId]) {
            const targetMsg = messages[chatId].find(m => m.id === messageId);
            if (targetMsg) {
                if (!targetMsg.reactions) targetMsg.reactions = {};

                if (targetMsg.reactions[userId] === emoji) {
                    delete targetMsg.reactions[userId];
                } else {
                    targetMsg.reactions[userId] = emoji;
                }

                io.to(chatId).emit('messages_updated', { chatId, messages: messages[chatId] });
                
                if (chatId.includes('--')) {
                    chatId.split('--').forEach(uid => {
                        io.to(uid).emit('messages_updated', { chatId, messages: messages[chatId] });
                    });
                }
            }
        }
    });

    socket.on('edit_message', ({ chatId, messageId, newText }) => {
        if (messages[chatId]) {
            const targetMsg = messages[chatId].find(m => m.id === messageId);
            if (targetMsg) {
                targetMsg.text = newText;
                targetMsg.isEdited = true; 
                
                io.to(chatId).emit('messages_updated', { chatId, messages: messages[chatId] });
                if (chatId.includes('--')) {
                    chatId.split('--').forEach(uid => {
                        io.to(uid).emit('messages_updated', { chatId, messages: messages[chatId] });
                    });
                }
            }
        }
    });

    socket.on('typing', (data) => {
        socket.to(data.chatId).emit('user_typing', {
            chatId: data.chatId,
            username: data.username,
            isTyping: data.isTyping
        });
    });

    socket.on('create_group', (data) => {
        const newGroup = {
            id: `group-${Date.now()}`,
            name: data.name,
            description: data.description || "Public Session Group",
            createdBy: users[socket.id]?.username || "User"
        };
        groups.push(newGroup);
        io.emit('update_groups', groups);
    });

    socket.on('messageSeen', ({ chatId, messageId, userId }) => {
        if (messages[chatId]) {
            const targetMsg = messages[chatId].find(m => m.id === messageId);
            if (targetMsg && !targetMsg.seenBy.includes(userId)) {
                targetMsg.seenBy.push(userId); 
            }
        }
        socket.to(chatId).emit("userSeenUpdate", { chatId, messageId, userId });
    });

    socket.on('delete_message', (data) => {
        if (messages[data.chatId]) {
            messages[data.chatId] = messages[data.chatId].filter(m => m.id !== data.messageId);
        }
        io.to(data.chatId).emit('message_deleted', data);
    });

    // Disconnect
    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('update_users', Object.values(users));
        console.log(`User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running perfectly on port ${PORT}`));