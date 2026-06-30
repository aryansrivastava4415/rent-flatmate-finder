const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

function registerChatSocket(io) {
  // Authenticate every socket connection via JWT (sent in handshake auth)
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Missing authentication token'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) return next(new Error('Invalid user'));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    // Client joins a specific chat room scoped to an accepted Interest
    socket.on('join_room', async ({ interestId }, ack) => {
      try {
        const interest = await prisma.interest.findUnique({
          where: { id: interestId },
          include: { listing: true },
        });
        if (!interest || interest.status !== 'ACCEPTED') {
          return ack?.({ ok: false, error: 'Chat not available for this interest' });
        }
        const isParticipant =
          interest.tenantId === socket.user.id || interest.listing.ownerId === socket.user.id;
        if (!isParticipant) return ack?.({ ok: false, error: 'Not a participant in this conversation' });

        socket.join(`interest:${interestId}`);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: 'Failed to join room' });
      }
    });

    // Send + persist a chat message
    socket.on('send_message', async ({ interestId, content }, ack) => {
      try {
        if (!content || !content.trim()) return ack?.({ ok: false, error: 'Message cannot be empty' });

        const interest = await prisma.interest.findUnique({
          where: { id: interestId },
          include: { listing: true },
        });
        if (!interest || interest.status !== 'ACCEPTED') {
          return ack?.({ ok: false, error: 'Chat not available for this interest' });
        }
        const isParticipant =
          interest.tenantId === socket.user.id || interest.listing.ownerId === socket.user.id;
        if (!isParticipant) return ack?.({ ok: false, error: 'Not a participant in this conversation' });

        const message = await prisma.message.create({
          data: { interestId, senderId: socket.user.id, content: content.trim() },
          include: { sender: { select: { id: true, name: true } } },
        });

        io.to(`interest:${interestId}`).emit('new_message', message);
        ack?.({ ok: true, message });
      } catch (err) {
        console.error('[chat.socket] send_message error:', err.message);
        ack?.({ ok: false, error: 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      // no-op; socket.io cleans up room membership automatically
    });
  });
}

module.exports = { registerChatSocket };
