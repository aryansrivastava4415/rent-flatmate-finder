const express = require('express');
const prisma = require('../prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/tenant/profile
router.get('/profile', authenticate, authorize('TENANT'), async (req, res) => {
  const profile = await prisma.tenantProfile.findUnique({ where: { userId: req.user.id } });
  res.json({ profile });
});

// PUT /api/tenant/profile (create or update)
router.put('/profile', authenticate, authorize('TENANT'), async (req, res) => {
  try {
    const { preferredLocation, budgetMin, budgetMax, moveInDate } = req.body;
    if (!preferredLocation || budgetMin == null || budgetMax == null || !moveInDate) {
      return res.status(400).json({ error: 'preferredLocation, budgetMin, budgetMax, moveInDate are required' });
    }
    if (Number(budgetMin) > Number(budgetMax)) {
      return res.status(400).json({ error: 'budgetMin cannot exceed budgetMax' });
    }

    const profile = await prisma.tenantProfile.upsert({
      where: { userId: req.user.id },
      update: {
        preferredLocation,
        budgetMin: Number(budgetMin),
        budgetMax: Number(budgetMax),
        moveInDate: new Date(moveInDate),
      },
      create: {
        userId: req.user.id,
        preferredLocation,
        budgetMin: Number(budgetMin),
        budgetMax: Number(budgetMax),
        moveInDate: new Date(moveInDate),
      },
    });

    // Preference changed -> stored compatibility scores for this tenant are stale, clear them
    // so they get recomputed on next browse.
    await prisma.compatibility.deleteMany({ where: { tenantId: req.user.id } });

    res.json({ profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

module.exports = router;
