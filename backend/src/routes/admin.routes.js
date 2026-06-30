const express = require('express');
const prisma = require('../prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, authorize('ADMIN'));

// GET /api/admin/users
router.get('/users', async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ users });
});

// PATCH /api/admin/users/:id - toggle active/disabled
router.patch('/users/:id', async (req, res) => {
  const { isActive } = req.body;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { isActive: Boolean(isActive) },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
  res.json({ user });
});

// GET /api/admin/listings
router.get('/listings', async (req, res) => {
  const listings = await prisma.listing.findMany({
    include: { owner: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ listings: listings.map((l) => ({ ...l, photos: JSON.parse(l.photos || '[]') })) });
});

// GET /api/admin/activity - platform-wide activity summary
router.get('/activity', async (req, res) => {
  const [userCount, listingCount, activeListingCount, interestCount, acceptedInterestCount, messageCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.listing.count(),
      prisma.listing.count({ where: { status: 'ACTIVE' } }),
      prisma.interest.count(),
      prisma.interest.count({ where: { status: 'ACCEPTED' } }),
      prisma.message.count(),
    ]);

  const recentInterests = await prisma.interest.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      tenant: { select: { name: true } },
      listing: { select: { location: true } },
    },
  });

  res.json({
    summary: {
      userCount,
      listingCount,
      activeListingCount,
      interestCount,
      acceptedInterestCount,
      messageCount,
    },
    recentInterests,
  });
});

module.exports = router;
