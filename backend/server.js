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

const isMongoConnected = () => mongoose.connection.readyState === 1;

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

const QUIZ_QUESTIONS = [
    { question: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Mercury'], answer: 1 },
    { question: 'How many sides does a hexagon have?', options: ['Five', 'Six', 'Seven', 'Eight'], answer: 1 },
    { question: 'Which ocean is the largest?', options: ['Atlantic', 'Indian', 'Pacific', 'Arctic'], answer: 2 },
    { question: 'What is the chemical symbol for gold?', options: ['Ag', 'Go', 'Gd', 'Au'], answer: 3 },
    { question: 'How many colors are in a rainbow traditionally?', options: ['Five', 'Six', 'Seven', 'Eight'], answer: 2 }
];

function createGameState(gameId) {
    if (gameId === 'connect-four') {
        return { gameId, board: Array(42).fill(null), currentPlayer: 0, winner: null };
    }
    if (gameId === 'rock-paper-scissors') {
        return { gameId, round: 1, scores: [0, 0], choices: [null, null], pending: [false, false], roundComplete: false, winner: null };
    }
    if (gameId === 'quiz-battle') {
        return { gameId, questionIndex: 0, scores: [0, 0], answers: [null, null], roundComplete: false, winner: null };
    }
    if (gameId === 'word-chain') {
        return { gameId, words: [], currentPlayer: 0, winner: null };
    }
    if (gameId === 'tank-battle') {
        return { gameId, scores: { p1: 0, p2: 0 }, winner: null };
    }
    return { gameId: 'tic-tac-toe', board: Array(9).fill(null), currentPlayer: 0, winner: null };
}

function checkConnectFourWinner(board) {
    const rows = 6;
    const columns = 7;
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
            const mark = board[row * columns + column];
            if (!mark) continue;
            for (const [rowStep, columnStep] of directions) {
                let matched = true;
                for (let step = 1; step < 4; step += 1) {
                    const nextRow = row + rowStep * step;
                    const nextColumn = column + columnStep * step;
                    if (nextRow < 0 || nextRow >= rows || nextColumn < 0 || nextColumn >= columns || board[nextRow * columns + nextColumn] !== mark) {
                        matched = false;
                        break;
                    }
                }
                if (matched) return mark;
            }
        }
    }
    return board.every(Boolean) ? 'DRAW' : null;
}

function getGamePublicState(game) {
    const publicState = { ...game.state, players: game.players.length };
    if (game.gameId === 'rock-paper-scissors' && !game.state.roundComplete) {
        publicState.choices = [null, null];
    }
    if (game.gameId === 'quiz-battle') {
        publicState.answered = game.state.answers.map(answer => answer !== null);
        if (!game.state.roundComplete) publicState.answers = [null, null];
    }
    return publicState;
}

// 🔌 Socket.IO Event Handlers
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    if (isMongoConnected()) {
        Gift.find()
            .then(gifts => socket.emit('update_gifts', gifts))
            .catch(err => console.error("Error fetching initial gifts:", err.message));
    } else {
        socket.emit('update_gifts', []);
    }

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
        
        if (isMongoConnected()) try {
            const gifts = await Gift.find();
            io.emit('update_gifts', gifts);
        } catch (err) {
            console.error("Error fetching gifts on login:", err.message);
        } else {
            socket.emit('update_gifts', []);
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
    socket.on('send_game_invite', ({ toUserId, senderName, chatId, gameId, gameName, gameRoomId }) => {
        io.to(toUserId).emit('receive_game_invite', {
            fromUserId: socket.id,
            senderName: senderName || 'Friend',
            chatId,
            gameId: gameId || 'tic-tac-toe',
            gameName: gameName || 'Tic-Tac-Toe',
            gameRoomId: gameRoomId || `game_${chatId}_${Date.now()}`
        });
    });

    // 2. Accept Game Invite (Tank Battle & Naye Games Allowed Here)
    socket.on('accept_game_invite', ({ chatId, fromUserId, gameId, gameName, gameRoomId }) => {
        const allowedGames = [
            'tic-tac-toe', 
            'connect-four', 
            'rock-paper-scissors', 
            'quiz-battle', 
            'word-chain',
            'tank-battle',
            'penalty-shootout',
            'stickman-run',
            'sword-duel'
        ];
        const selectedGameId = allowedGames.includes(gameId) ? gameId : 'tic-tac-toe';
        const selectedGameName = String(gameName || 'Tic-Tac-Toe').slice(0, 40);
        const roomId = typeof gameRoomId === 'string' && gameRoomId.length < 180
            ? gameRoomId
            : `game_${chatId}_${Date.now()}`;
        const senderSocket = io.sockets.sockets.get(fromUserId);
        if (!senderSocket || fromUserId === socket.id) return;

        const game = {
            gameRoomId: roomId,
            gameId: selectedGameId,
            gameName: selectedGameName,
            players: [
                { socketId: fromUserId, symbol: 'X' },
                { socketId: socket.id, symbol: 'O' }
            ],
            state: createGameState(selectedGameId)
        };
        activeGames[roomId] = game;
        senderSocket.join(roomId);
        socket.join(roomId);

        game.players.forEach((player, playerIndex) => {
            io.to(player.socketId).emit('game_started', {
                gameRoomId: roomId,
                gameId: selectedGameId,
                gameName: selectedGameName,
                playerIndex,
                symbol: player.symbol,
                state: getGamePublicState(game)
            });
        });
    });

    // 3. Reject Game Invite
    socket.on('reject_game_invite', ({ fromUserId, gameName }) => {
        io.to(fromUserId).emit('game_invite_rejected', { gameName: gameName || 'Game' });
    });

    socket.on('join_game', ({ gameRoomId } = {}) => {
        const game = activeGames[gameRoomId];
        if (!game) {
            socket.emit('game_session_missing', { gameRoomId });
            return;
        }
        if (!game.players.some(player => player.socketId === socket.id)) return;
        socket.join(gameRoomId);
        socket.emit('game_state', { gameRoomId, ...getGamePublicState(game) });
    });

    // 4. Game Move Handlers
    socket.on('game_action', ({ gameRoomId, action } = {}) => {
        const game = activeGames[gameRoomId];
        if (!game || !action || typeof action.type !== 'string') return;
        const playerIndex = game.players.findIndex(player => player.socketId === socket.id);
        if (playerIndex < 0) return;
        if (action.type === 'restart') {
            game.state = createGameState(game.gameId);
            io.to(gameRoomId).emit('game_state', { gameRoomId, ...getGamePublicState(game) });
            return;
        }
        if (game.state.winner !== null) return;
        const state = game.state;
        const reject = (message) => socket.emit('game_action_error', { gameRoomId, message });

        if (game.gameId === 'tic-tac-toe' && action.type === 'place') {
            const index = Number(action.index);
            if (state.currentPlayer !== playerIndex || !Number.isInteger(index) || index < 0 || index > 8 || state.board[index]) return;
            state.board[index] = game.players[playerIndex].symbol;
            state.winner = checkWinner(state.board);
            if (state.winner === 'DRAW') state.winner = 'DRAW';
            if (!state.winner) state.currentPlayer = 1 - playerIndex;
        } else if (game.gameId === 'connect-four' && action.type === 'drop') {
            const column = Number(action.column);
            if (state.currentPlayer !== playerIndex || !Number.isInteger(column) || column < 0 || column > 6) return;
            let row = 5;
            while (row >= 0 && state.board[row * 7 + column]) row -= 1;
            if (row < 0) return;
            state.board[row * 7 + column] = game.players[playerIndex].symbol;
            state.winner = checkConnectFourWinner(state.board);
            if (!state.winner) state.currentPlayer = 1 - playerIndex;
        } else if (game.gameId === 'rock-paper-scissors' && action.type === 'choose') {
            const choice = action.choice;
            if (!['rock', 'paper', 'scissors'].includes(choice) || state.roundComplete || state.choices[playerIndex]) return;
            state.choices[playerIndex] = choice;
            state.pending[playerIndex] = true;
            if (state.choices.every(Boolean)) {
                const [first, second] = state.choices;
                if (first !== second) {
                    const firstWins = (first === 'rock' && second === 'scissors') || (first === 'paper' && second === 'rock') || (first === 'scissors' && second === 'paper');
                    state.scores[firstWins ? 0 : 1] += 1;
                }
                state.roundComplete = true;
                if (state.round >= 3 || Math.max(...state.scores) >= 2) {
                    state.winner = state.scores[0] === state.scores[1] ? 'DRAW' : state.scores[0] > state.scores[1] ? 0 : 1;
                }
            }
        } else if (game.gameId === 'rock-paper-scissors' && action.type === 'next-round') {
            if (!state.roundComplete || state.winner !== null) return;
            state.round += 1;
            state.choices = [null, null];
            state.pending = [false, false];
            state.roundComplete = false;
        } else if (game.gameId === 'quiz-battle' && action.type === 'answer') {
            const answerIndex = Number(action.answerIndex);
            const question = QUIZ_QUESTIONS[state.questionIndex];
            if (!question || state.roundComplete || state.answers[playerIndex] !== null || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= question.options.length) return;
            state.answers[playerIndex] = answerIndex;
            if (state.answers.every(answer => answer !== null)) {
                state.correctAnswer = question.answer;
                state.answers.forEach((answer, index) => {
                    if (answer === question.answer) state.scores[index] += 1;
                });
                state.roundComplete = true;
            }
        } else if (game.gameId === 'quiz-battle' && action.type === 'next-question') {
            if (!state.roundComplete) return;
            if (state.questionIndex >= QUIZ_QUESTIONS.length - 1) {
                state.winner = state.scores[0] === state.scores[1] ? 'DRAW' : state.scores[0] > state.scores[1] ? 0 : 1;
            } else {
                state.questionIndex += 1;
                state.answers = [null, null];
                state.correctAnswer = null;
                state.roundComplete = false;
            }
        } else if (game.gameId === 'word-chain' && action.type === 'word') {
            const word = String(action.word || '').trim().toLowerCase();
            const previousWord = state.words[state.words.length - 1]?.word;
            const usedWords = new Set(state.words.map(entry => entry.word));
            if (state.currentPlayer !== playerIndex) return;
            if (!/^[a-z]{2,24}$/.test(word) || usedWords.has(word) || (previousWord && word[0] !== previousWord.at(-1))) {
                reject(previousWord ? `Word must be new and start with "${previousWord.at(-1).toUpperCase()}".` : 'Enter a new English word (2-24 letters).');
                return;
            }
            state.words.push({ word, playerIndex });
            state.currentPlayer = 1 - playerIndex;
        } else {
            return;
        }

        io.to(gameRoomId).emit('game_state', { gameRoomId, ...getGamePublicState(game) });
    });

    socket.on('make_move', ({ gameRoomId, newBoard, symbol }) => {
        const game = activeGames[gameRoomId];
        const playerIndex = game?.players.findIndex(player => player.socketId === socket.id);
        if (!game || game.gameId !== 'tic-tac-toe' || playerIndex < 0 || game.state.currentPlayer !== playerIndex || game.players[playerIndex].symbol !== symbol) return;
        const index = newBoard?.findIndex((cell, cellIndex) => cell && !game.state.board[cellIndex]);
        if (index >= 0) socket.emit('game_action_error', { gameRoomId, message: 'This game session is outdated. Reopen the game to continue.' });
    });

    socket.on('reset_game', ({ gameRoomId }) => {
        const game = activeGames[gameRoomId];
        if (!game || !game.players.some(player => player.socketId === socket.id)) return;
        game.state = createGameState(game.gameId);
        io.to(gameRoomId).emit('game_state', { gameRoomId, ...getGamePublicState(game) });
    });

    // 🎁 Add Gift
    socket.on('add_gift', async (giftData) => {
        if (!giftData || !giftData.senderName || !giftData.receiverName || !giftData.giftUrl) return;
        if (!isMongoConnected()) {
            socket.emit('push_notification', {
                title: 'Gifts temporarily unavailable',
                message: 'Gift storage needs a running MongoDB connection.'
            });
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
        if (!isMongoConnected()) return;
        try {
            await Gift.findByIdAndDelete(giftId);
            const updatedGifts = await Gift.find().sort({ createdAt: -1 });
            io.emit('update_gifts', updatedGifts);
        } catch (err) {
            console.error("❌ Delete Error:", err.message);
        }
    });

    socket.on('get_gifts', async () => {
        if (!isMongoConnected()) {
            socket.emit('update_gifts', []);
            return;
        }
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
        const isAuthenticationError = /missing authentication header|no auth credentials|unauthorized|invalid api key/i.test(error.message);
        return res.json({
            reply: isQuotaError
                ? 'Gemini ka free quota abhi complete ho gaya hai. Thodi der baad try karein, ya Gemini billing/another API key enable karein. Tab tak main basic chat mode me hoon: ' + buildLocalAiReply(message, userName)
                : isAuthenticationError
                    ? 'AI provider ki API key missing ya invalid hai. Backend host ke environment variables me nayi valid OpenRouter key set karke service restart karein. Tab tak basic chat mode: ' + buildLocalAiReply(message, userName)
                    : buildLocalAiReply(message, userName),
            providerUnavailable: true,
            reason: isQuotaError ? 'quota_exceeded' : isAuthenticationError ? 'authentication_failed' : 'provider_error'
        });
    }
});

const selectedAiProvider = process.env.AI_PROVIDER?.trim().toLowerCase() || 'auto';
const hasSelectedProviderKey = selectedAiProvider === 'openrouter'
    ? Boolean(process.env.OPENROUTER_API_KEY?.trim())
    : selectedAiProvider === 'gemini'
        ? Boolean(process.env.GEMINI_API_KEY?.trim())
        : Boolean(process.env.OPENROUTER_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim());
console.log(`AI provider: ${selectedAiProvider}; credential configured: ${hasSelectedProviderKey ? 'yes' : 'no'}`);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running perfectly on port ${PORT}`));