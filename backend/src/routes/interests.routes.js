const express = require('express');
const prisma = require('../prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { sendEmail } = require('../services/email.service');

const router = express.Router();

const HIGH_COMPAT_THRESHOLD = 80;

// POST /api/interests (tenant expresses interest in a listing)
router.post('/', authenticate, authorize('TENANT'), async (req, res) => {
  try {
    const { listingId } = req.body;
    if (!listingId) return res.status(400).json({ error: 'listingId is required' });

    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: { owner: true },
    });
    if (!listing || listing.status !== 'ACTIVE') {
      return res.status(404).json({ error: 'Listing not found or no longer available' });
    }

    const existing = await prisma.interest.findUnique({
      where: { tenantId_listingId: { tenantId: req.user.id, listingId } },
    });
    if (existing) return res.status(409).json({ error: 'Interest already expressed for this listing' });

    const compat = await prisma.compatibility.findUnique({
      where: { tenantId_listingId: { tenantId: req.user.id, listingId } },
    });

    const interest = await prisma.interest.create({
      data: {
        tenantId: req.user.id,
        listingId,
        compatScore: compat ? compat.score : null,
      },
    });

    // Notify owner; escalate subject line for high-compatibility matches
    const isHighMatch = compat && compat.score > HIGH_COMPAT_THRESHOLD;
    await sendEmail({
      to: listing.owner.email,
      subject: isHighMatch
        ? `Strong match! ${req.user.name} is interested in your listing (score: ${compat.score})`
        : `${req.user.name} expressed interest in your listing`,
      text: `${req.user.name} (${req.user.email}) is interested in your listing at ${listing.location}.${
        compat ? ` Compatibility score: ${compat.score}/100. ${compat.explanation}` : ''
      }\n\nLog in to accept or decline this request.`,
    });

    res.status(201).json({ interest });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to express interest' });
  }
});

// GET /api/interests/mine (tenant's own interest requests)
router.get('/mine', authenticate, authorize('TENANT'), async (req, res) => {
  const interests = await prisma.interest.findMany({
    where: { tenantId: req.user.id },
    include: { listing: { include: { owner: { select: { id: true, name: true, email: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ interests });
});

// GET /api/interests/received (owner views interest requests on their listings)
router.get('/received', authenticate, authorize('OWNER'), async (req, res) => {
  const interests = await prisma.interest.findMany({
    where: { listing: { ownerId: req.user.id } },
    include: {
      listing: true,
      tenant: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ interests });
});

// PATCH /api/interests/:id (owner accepts or declines)
router.patch('/:id', authenticate, authorize('OWNER'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['ACCEPTED', 'DECLINED'].includes(status)) {
      return res.status(400).json({ error: 'status must be ACCEPTED or DECLINED' });
    }

    const interest = await prisma.interest.findUnique({
      where: { id: req.params.id },
      include: { listing: true, tenant: true },
    });
    if (!interest) return res.status(404).json({ error: 'Interest not found' });
    if (interest.listing.ownerId !== req.user.id) return res.status(403).json({ error: 'Not your listing' });

    const updated = await prisma.interest.update({ where: { id: req.params.id }, data: { status } });

    await sendEmail({
      to: interest.tenant.email,
      subject: `Your interest request was ${status === 'ACCEPTED' ? 'accepted' : 'declined'}`,
      text: `${req.user.name} has ${status === 'ACCEPTED' ? 'accepted' : 'declined'} your interest in the listing at ${interest.listing.location}.${
        status === 'ACCEPTED' ? ' You can now chat in real time from the app.' : ''
      }`,
    });

    res.json({ interest: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update interest' });
  }
});

module.exports = router;
