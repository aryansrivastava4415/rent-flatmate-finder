const express = require('express');
const prisma = require('../prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

async function assertParticipant(req, res, next) {
  const interest = await prisma.interest.findUnique({
    where: { id: req.params.interestId },
    include: { listing: true },
  });
  if (!interest) return res.status(404).json({ error: 'Chat thread not found' });
  if (interest.status !== 'ACCEPTED') {
    return res.status(403).json({ error: 'Chat is only available once interest has been accepted' });
  }
  const isTenant = interest.tenantId === req.user.id;
  const isOwner = interest.listing.ownerId === req.user.id;
  if (!isTenant && !isOwner) return res.status(403).json({ error: 'You are not part of this conversation' });

  req.interest = interest;
  next();
}

// GET /api/chat/:interestId/messages - message history
router.get('/:interestId/messages', authenticate, assertParticipant, async (req, res) => {
  const messages = await prisma.message.findMany({
    where: { interestId: req.params.interestId },
    orderBy: { createdAt: 'asc' },
    include: { sender: { select: { id: true, name: true } } },
  });
  res.json({ messages });
});

// GET /api/chat/threads - list accepted interests this user can chat in (both roles)
router.get('/', authenticate, async (req, res) => {
  const threads = await prisma.interest.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ tenantId: req.user.id }, { listing: { ownerId: req.user.id } }],
    },
    include: {
      listing: { include: { owner: { select: { id: true, name: true } } } },
      tenant: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ threads });
});

module.exports = router;
