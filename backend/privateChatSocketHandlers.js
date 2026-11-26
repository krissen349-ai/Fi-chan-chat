function registerPrivateChatSocketHandlers({ socket, users, messages, getPrivateChatParticipants }) {
  socket.on('typing', (data = {}, acknowledge) => {
    if (typeof data.chatId !== 'string' || !data.chatId.includes('--')) return;

    const user = users[socket.id];
    const participants = getPrivateChatParticipants(data.chatId);
    if (!user?.verifiedUid || !participants?.includes(user.verifiedUid)
        || !socket.rooms.has(data.chatId)) {
      return acknowledge?.({ ok: false, error: 'Join this private chat as a verified participant first.' });
    }

    socket.to(data.chatId).emit('user_typing', {
      chatId: data.chatId,
      username: user.username || 'User',
      isTyping: Boolean(data.isTyping)
    });
    acknowledge?.({ ok: true });
  });

  socket.on('messageSeen', ({ chatId, messageId } = {}, acknowledge) => {
    if (typeof chatId !== 'string' || !chatId.includes('--')) return;

    const user = users[socket.id];
    const participants = getPrivateChatParticipants(chatId);
    if (!user?.verifiedUid || !participants?.includes(user.verifiedUid)
        || !socket.rooms.has(chatId) || typeof messageId !== 'string' || !messageId) {
      return acknowledge?.({ ok: false, error: 'Join this private chat as a verified participant first.' });
    }

    const targetMessage = messages[chatId]?.find(message => message.id === messageId);
    if (targetMessage) {
      const seenBy = Array.isArray(targetMessage.seenBy) ? targetMessage.seenBy : [];
      if (!seenBy.includes(user.verifiedUid)) targetMessage.seenBy = [...seenBy, user.verifiedUid];
    }

    socket.to(chatId).emit('userSeenUpdate', {
      chatId,
      messageId,
      userId: user.verifiedUid
    });
    acknowledge?.({ ok: true });
  });
}

module.exports = { registerPrivateChatSocketHandlers };
