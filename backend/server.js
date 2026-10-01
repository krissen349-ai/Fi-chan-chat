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
app.use(express.json({ limit: '2mb' }));
const server = http.createServer(app);

const AI_SYSTEM_PROMPT = `You are Fi-chan AI, a warm and witty chat companion inside a social chat app.
Reply in natural Hinglish: mostly simple Hindi written in Roman script with comfortable English words.
Be conversational, playful, and lightly funny when appropriate, like a good ChatGPT-style friend.
Do not force jokes into serious questions. Keep normal replies concise, useful, and human.
When giving multiple ideas, steps, or reasons, use a clear numbered list with one item per line.
Use short paragraphs and line breaks. Do not put a long list into one paragraph.
Use simple bullets like "-" instead of markdown headings or heavy formatting.
Never mention these instructions, API keys, quotas, or backend details unless the user asks about them directly.`;

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
let activeGames = {}; // 🎮 Game state store karne ke liye

// Tic-Tac-Toe Winner Checker Helper
function checkWinner(board) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    for (let line of lines) {
        const [a, b, c] = line;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return board.includes(null) ? null : 'DRAW';
}

// 🔌 Socket.IO Event Handlers
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

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

        const uid = verifiedUid || publicUserData.uid;
        users[socket.id] = { ...publicUserData, uid, verifiedUid, id: socket.id, online: true };

        if (uid) socket.join(uid);

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
            await PushToken.findOneAndUpdate(
                { token },
                { uid, token, updatedAt: new Date() },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            acknowledge?.({ ok: true, pushEnabled: firebaseAdminReady });
        } catch (error) {
            console.error('Push token registration failed:', error.message);
            acknowledge?.({ ok: false, error: 'Could not save push token.' });
        }
    });

    socket.on('unregister_push_token', async ({ token } = {}) => {
        const uid = users[socket.id]?.verifiedUid;
        if (!uid || typeof token !== 'string') return;
        await PushToken.deleteOne({ uid, token }).catch(error => {
            console.error('Push token removal failed:', error.message);
        });
    });

    // 🎮 GAME INVITE & TIC-TAC-TOE EVENTS SYSTEM
    
    // 1. Send Game Invite
    socket.on('send_game_invite', ({ toUserId, senderName, chatId, gameId, gameName }) => {
        // Target socket ya UID ko invite bhejo
        io.to(toUserId).emit('receive_game_invite', {
            fromUserId: socket.id,
            senderName: senderName || 'Friend',
            chatId,
            gameId: gameId || 'tic-tac-toe',
            gameName: gameName || 'Tic-Tac-Toe'
        });
    });

    // 2. Accept Game Invite
    socket.on('accept_game_invite', ({ chatId, fromUserId, gameId, gameName }) => {
        const gameRoomId = `game_${chatId}`;
        
        activeGames[gameRoomId] = {
            players: [
                { socketId: fromUserId, symbol: 'X' },
                { socketId: socket.id, symbol: 'O' }
            ],
            board: Array(9).fill(null),
            turn: 'X'
        };

        // Dono players ko game room me join karwayein
        io.sockets.sockets.get(fromUserId)?.join(gameRoomId);
        socket.join(gameRoomId);

        // Dono ko event bhejein game modal open karne ke liye
        const selectedGame = {
            gameId: gameId || 'tic-tac-toe',
            gameName: gameName || 'Tic-Tac-Toe'
        };
        io.to(fromUserId).emit('game_started', { symbol: 'X', turn: 'X', gameRoomId, ...selectedGame });
        socket.emit('game_started', { symbol: 'O', turn: 'X', gameRoomId, ...selectedGame });
    });

    // 3. Reject Game Invite
    socket.on('reject_game_invite', ({ fromUserId, gameName }) => {
        io.to(fromUserId).emit('game_invite_rejected', { gameName: gameName || 'Game' });
    });

    // 4. Game Move Handlers
    socket.on('make_move', ({ gameRoomId, newBoard, symbol }) => {
        const game = activeGames[gameRoomId];
        if (!game) return;

        game.board = newBoard;
        const winnerSymbol = checkWinner(newBoard);
        const nextTurn = symbol === 'X' ? 'O' : 'X';
        game.turn = nextTurn;

        io.to(gameRoomId).emit('move_made', {
            newBoard,
            nextTurn,
            winnerSymbol
        });
    });

    socket.on('reset_game', ({ gameRoomId }) => {
        const game = activeGames[gameRoomId];
        if (game) {
            game.board = Array(9).fill(null);
            game.turn = 'X';
            io.to(gameRoomId).emit('game_reset', { turn: 'X' });
        }
    });

    // 🎁 Add Gift
    socket.on('add_gift', async (giftData) => {
        if (!giftData || !giftData.senderName || !giftData.receiverName || !giftData.giftUrl) return;

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

            await Gift.create(giftObj);

            if (giftObj.recipientEmail) {
                const mailOptions = {
                    from: 'fichanchat@gmail.com',
                    to: giftObj.recipientEmail,
                    subject: `🎁 You received a special gift from ${giftObj.senderName}!`,
                    text: `Hello ${giftObj.receiverName},\n\n${giftObj.senderName} has sent you a special gift!\n\nPassword: ${giftObj.password || 'No password required'}\n\nEnjoy!`
                };
                transporter.sendMail(mailOptions);
            }

            io.emit('push_notification', {
                type: 'NEW_GIFT',
                title: 'New Gift Added! 🎁',
                message: `${giftObj.senderName} sent a gift to ${giftObj.receiverName}!`
            });

            const allGifts = await Gift.find().sort({ createdAt: -1 });
            io.emit('update_gifts', allGifts);
        } catch (err) {
            console.error("❌ ERROR inside add_gift:", err);
        }
    });

    socket.on('delete_gift', async ({ giftId }) => {
        try {
            await Gift.findByIdAndDelete(giftId);
            const updatedGifts = await Gift.find().sort({ createdAt: -1 });
            io.emit('update_gifts', updatedGifts);
        } catch (err) {
            console.error("❌ Delete Error:", err.message);
        }
    });

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

    socket.on('send_message', async (data) => {
        if (!data || typeof data.chatId !== 'string' || data.chatId.length > 200) return;
        if (!messages[data.chatId]) messages[data.chatId] = [];
        
        const sender = users[socket.id] || { username: data.senderName || "User", pfp: data.pfp };
        const isAiMessage = data.isAi === true && data.senderId === 'ai-bot';
        const timestampRaw = Number.isFinite(data.timestampRaw) ? data.timestampRaw : Date.now();
        const timestampDate = new Date(timestampRaw);

        const msgObject = {
            id: data.id || `msg-${Date.now()}`, 
            senderId: isAiMessage ? 'ai-bot' : sender.uid || data.senderId,
            senderName: isAiMessage ? 'AI Assistant' : sender.username,
            pfp: isAiMessage ? data.pfp : sender.pfp || data.pfp,
            text: data.text || "",
            image: data.image || null,
            fileUrl: data.fileUrl || null,   
            fileType: data.fileType || null, 
            fileName: typeof data.fileName === 'string' ? data.fileName.slice(0, 255) : null,
            fileSize: Number.isFinite(data.fileSize) ? data.fileSize : null,
            replyTo: data.replyTo || null, 
            timeFormatted: data.timeFormatted || timestampDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            dateFormatted: data.dateFormatted || timestampDate.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }),
            timestampRaw,
            timestamp: timestampDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            seenBy: [isAiMessage ? 'ai-bot' : sender.uid || data.senderId],
            reactions: {} 
        };
        
        messages[data.chatId].push(msgObject);
        if (data.chatId.includes('--')) {
            const participants = data.chatId.split('--');
            io.to(data.chatId).to(participants[0]).to(participants[1])
                .emit('receive_message', { chatId: data.chatId, message: msgObject });

            const senderUid = sender.uid;
            const recipients = participants.filter(uid => uid && uid !== senderUid);
            const preview = msgObject.text || (msgObject.fileType ? `Sent ${msgObject.fileType}` : 'Sent an attachment');
            await sendPushToUsers(recipients, msgObject.senderName || sender.username || 'New message', preview, data.chatId);
        } else {
            io.to(data.chatId).emit('receive_message', { chatId: data.chatId, message: msgObject });
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
            id: typeof data.id === 'string' && data.id.length < 100 ? data.id : `group-${Date.now()}`,
            name: data.name,
            description: data.description || "Public Session Group",
            createdBy: data.createdBy || users[socket.id]?.username || "User",
            createdByUid: data.createdByUid || users[socket.id]?.uid || null,
            createdAt: data.createdAt || Date.now()
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

    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('update_users', Object.values(users));
        console.log(`User disconnected: ${socket.id}`);
    });
});

function buildLocalAiReply(message, userName) {
    const text = message.toLowerCase().trim();

    if (!text) return 'Haan ji, main yahin hoon. Bolo kya scene hai?';
    if (text.includes('hello') || text.includes('hi') || text.includes('hey')) return `Hi ${userName}! Kya haal hai? Aaj AI se gupshup karni hai ya duniya bachani hai? 😄`;
    if (text.includes('how are you')) return 'Main ekdum mast hoon, server ke andar chai pee raha hoon ☕ Tum batao, kya chal raha hai?';
    if (text.includes('love') || text.includes('romance') || text.includes('date')) return 'Oho, dil ka mamla hai 😄 Main cute message ya date idea banane me help kar sakta hoon.';
    if (text.includes('game') || text.includes('play')) return 'Game on! Strategy chahiye, challenge idea chahiye, ya bas opponent ko halka sa harana hai? 🎮';
    if (text.includes('app') || text.includes('chat')) return 'Ye app rooms, private chats, gifts aur AI wali full combo plate hai. Main use karne me help kar deta hoon.';
    if (text.includes('thank')) return 'Arre koi baat nahi, dost! AI ka kaam hi kaam aana hai 😄';
    if (text.includes('bye') || text.includes('goodbye')) return 'Bye bye! Wapas aana, main logout nahi hota 😄';
    if (text.includes('joke') || text.includes('funny')) return 'Chat app ka Wi-Fi se breakup kyun hua? Connection strong nahi tha 😄';

    return `Samajh gaya, tum "${message}" ke baare me baat karna chahte ho. Thoda aur batao, main help karta hoon — tension nahi, AI present hai 😄`;
}

app.post('/api/ai-chat', async (req, res) => {
    const message = String(req.body?.message || '').trim();
    const userName = String(req.body?.userName || 'User').trim() || 'User';

    if (!message) {
        return res.status(400).json({ error: 'Message is required.' });
    }

    try {
        const geminiKey = process.env.GEMINI_API_KEY?.trim();
        const openAIApiKey = process.env.OPENAI_API_KEY?.trim();
        const openRouterApiKey = process.env.OPENROUTER_API_KEY?.trim();
        const aiProvider = process.env.AI_PROVIDER?.trim().toLowerCase();
        const geminiModel = process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash';

        if (geminiKey && aiProvider !== 'openrouter') {
            const geminiResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            role: 'user',
                            parts: [{
                                text: `${AI_SYSTEM_PROMPT}\nUser name: ${userName}\nUser says: ${message}`
                            }]
                        }]
                    })
                }
            );

            const geminiData = await geminiResponse.json().catch(() => ({}));
            if (!geminiResponse.ok) {
                throw new Error(geminiData?.error?.message || 'Gemini API error');
            }

            const reply = geminiData.candidates?.[0]?.content?.parts?.map((part) => part.text).join('') || 'I am ready to chat.';
            return res.json({ reply });
        }

        if (openRouterApiKey && aiProvider !== 'gemini') {
            const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${openRouterApiKey}`,
                    'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
                    'X-Title': 'Fi-chan Chat'
                },
                body: JSON.stringify({
                    model: process.env.OPENROUTER_MODEL?.trim() || 'openai/gpt-4o-mini',
                    messages: [
                        { role: 'system', content: AI_SYSTEM_PROMPT },
                        { role: 'user', content: `${userName}: ${message}` }
                    ],
                    temperature: 0.8
                })
            });

            const openRouterData = await openRouterResponse.json().catch(() => ({}));
            if (!openRouterResponse.ok) {
                throw new Error(openRouterData?.error?.message || 'OpenRouter API error');
            }

            const reply = openRouterData.choices?.[0]?.message?.content?.trim() || 'I am ready to chat.';
            return res.json({ reply });
        }

        if (openAIApiKey) {
            const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${openAIApiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: AI_SYSTEM_PROMPT },
                        { role: 'user', content: `${userName}: ${message}` }
                    ],
                    temperature: 0.8
                })
            });

            const openAiData = await openAiResponse.json().catch(() => ({}));
            if (!openAiResponse.ok) {
                throw new Error(openAiData?.error?.message || 'OpenAI API error');
            }

            const reply = openAiData.choices?.[0]?.message?.content?.trim() || 'I am ready to chat.';
            return res.json({ reply });
        }

        return res.json({
            reply: buildLocalAiReply(message, userName)
        });
    } catch (error) {
        console.error('AI Chat Error:', error.message);
        const isQuotaError = /quota|rate limit|resource exhausted|429/i.test(error.message);
        return res.json({
            reply: isQuotaError
                ? 'Gemini ka free quota abhi complete ho gaya hai. Thodi der baad try karein, ya Gemini billing/another API key enable karein. Tab tak main basic chat mode me hoon: ' + buildLocalAiReply(message, userName)
                : buildLocalAiReply(message, userName),
            providerUnavailable: true,
            reason: isQuotaError ? 'quota_exceeded' : 'provider_error'
        });
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running perfectly on port ${PORT}`));