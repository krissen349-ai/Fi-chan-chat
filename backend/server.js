// 🚀 SERVER-SIDE (server.js)
require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); 

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer'); 
const admin = require('firebase-admin');

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, { 
    cors: { origin: "*" },
    maxHttpBufferSize: 6 * 1024 * 1024
});

// 🍃 MongoDB Connection Setup
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000
})
  .then(() => console.log("✅ MongoDB Connected Successfully! 🍃"))
  .catch((err) => console.log("❌ DB Connection Error:", err.message));

let firebaseAdminReady = false;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        serviceAccount.private_key = serviceAccount.private_key?.replace(/\\n/g, '\n');
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        firebaseAdminReady = true;
        console.log('Firebase Admin push notifications enabled.');
    } catch (error) {
        console.error('Firebase Admin initialization failed:', error.message);
    }
} else {
    console.warn('Firebase Admin push disabled: FIREBASE_SERVICE_ACCOUNT_JSON is not configured.');
}

process.on('unhandledRejection', (reason) => {
    console.log('⚠️ Unhandled Rejection:', reason.message || reason);
});

// 📧 Nodemailer Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// 🎁 Mongoose Schema
const giftSchema = new mongoose.Schema({
  senderName: { type: String, required: true },
  receiverName: { type: String, required: true },
  recipientEmail: { type: String, default: "" }, 
  giftUrl: { type: String, required: true },
  password: { type: String, default: "" }, 
  enableBalloonGame: { type: Boolean, default: true },
  targetAge: { type: Number, default: 21 },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Gift = mongoose.model('Gift', giftSchema);

const pushTokenSchema = new mongoose.Schema({
    uid: { type: String, required: true, index: true },
    token: { type: String, required: true, unique: true },
    updatedAt: { type: Date, default: Date.now }
});
const PushToken = mongoose.model('PushToken', pushTokenSchema);

async function sendPushToUsers(uids, title, body, chatId) {
    if (!firebaseAdminReady || !uids.length) return;

    try {
        const records = await PushToken.find({ uid: { $in: uids } }).lean();
        if (!records.length) return;

        const response = await admin.messaging().sendEachForMulticast({
            tokens: records.map(record => record.token),
            data: {
                title: String(title).slice(0, 100),
                body: String(body).slice(0, 240),
                icon: '/fi-chan-logo.jpg',
                url: '/',
                chatId: String(chatId)
            },
            webpush: { headers: { Urgency: 'high' } }
        });

        const invalidTokens = response.responses
            .map((result, index) => ({ result, token: records[index].token }))
            .filter(({ result }) => !result.success && [
                'messaging/registration-token-not-registered',
                'messaging/invalid-registration-token'
            ].includes(result.error?.code))
            .map(({ token }) => token);

        if (invalidTokens.length) {
            await PushToken.deleteMany({ token: { $in: invalidTokens } });
        }
    } catch (error) {
        console.error('Push delivery failed:', error.message);
    }
}

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
    socket.on('login_user', async (userData = {}, acknowledge) => {
        const { idToken, ...publicUserData } = userData;
        let verifiedUid = null;
        if (firebaseAdminReady && idToken) {
            try {
                verifiedUid = (await admin.auth().verifyIdToken(idToken)).uid;
            } catch (error) {
                console.warn('Firebase socket authentication failed:', error.message);
            }
        }

        io.emit('update_users', Object.values(users));
        io.emit('update_groups', groups);
        acknowledge?.({ ok: true, verified: Boolean(verifiedUid) });
        
        try {
            const gifts = await Gift.find();
            io.emit('update_gifts', gifts);
        } catch (err) {
            console.error("Error fetching gifts on login:", err.message);
        }
    });

    socket.on('register_push_token', async ({ token } = {}, acknowledge) => {
        const uid = users[socket.id]?.verifiedUid;
        if (!uid || typeof token !== 'string' || token.length < 20 || token.length > 4096) {
            acknowledge?.({ ok: false, error: 'Sign in again or configure Firebase Admin to register this device.' });
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