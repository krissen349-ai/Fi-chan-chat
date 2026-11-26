const test = require('node:test');
const assert = require('node:assert/strict');
const { registerPrivateChatSocketHandlers } = require('./privateChatSocketHandlers');

const createSocket = ({ user, rooms = [] } = {}) => {
  const listeners = {};
  const emissions = [];
  const socket = {
    id: 'socket-a',
    rooms: new Set(['socket-a', ...rooms]),
    on(eventName, handler) {
      listeners[eventName] = handler;
    },
    to(room) {
      return {
        emit(eventName, data) {
          emissions.push({ room, eventName, data });
        }
      };
    }
  };
  const users = user ? { [socket.id]: user } : {};
  const messages = {};

  registerPrivateChatSocketHandlers({
    socket,
    users,
    messages,
    getPrivateChatParticipants: chatId => {
      const participants = chatId.split('--');
      return participants.length === 2 ? participants : null;
    }
  });

  return { listeners, emissions, messages, socket };
};

test('private typing relays only to its joined room using verified identity', () => {
  const chatId = 'uid-a--uid-b';
  const { listeners, emissions } = createSocket({
    user: { verifiedUid: 'uid-a', username: 'Verified Alice' },
    rooms: [chatId]
  });
  let acknowledgement;

  listeners.typing(
    { chatId, username: 'Spoofed Name', isTyping: true },
    result => { acknowledgement = result; }
  );

  assert.deepEqual(acknowledgement, { ok: true });
  assert.deepEqual(emissions, [{
    room: chatId,
    eventName: 'user_typing',
    data: { chatId, username: 'Verified Alice', isTyping: true }
  }]);
});

test('private typing rejects an unverified user or a socket outside the room', () => {
  const chatId = 'uid-a--uid-b';
  const unverified = createSocket({
    user: { uid: 'uid-a', username: 'Alice' },
    rooms: [chatId]
  });
  const notJoined = createSocket({
    user: { verifiedUid: 'uid-a', username: 'Alice' }
  });

  for (const { listeners, emissions } of [unverified, notJoined]) {
    let acknowledgement;
    listeners.typing({ chatId, isTyping: true }, result => { acknowledgement = result; });
    assert.equal(acknowledgement?.ok, false);
    assert.equal(emissions.length, 0);
  }
});

test('private seen receipts use verified UID and acknowledge the sender', () => {
  const chatId = 'uid-a--uid-b';
  const { listeners, emissions, messages } = createSocket({
    user: { verifiedUid: 'uid-a' },
    rooms: [chatId]
  });
  messages[chatId] = [{ id: 'message-1', seenBy: ['uid-b'] }];
  let acknowledgement;

  listeners.messageSeen(
    { chatId, messageId: 'message-1', userId: 'uid-b' },
    result => { acknowledgement = result; }
  );

  assert.deepEqual(acknowledgement, { ok: true });
  assert.deepEqual(messages[chatId][0].seenBy, ['uid-b', 'uid-a']);
  assert.deepEqual(emissions, [{
    room: chatId,
    eventName: 'userSeenUpdate',
    data: { chatId, messageId: 'message-1', userId: 'uid-a' }
  }]);
});
