const express = require('express');
const prisma = require('../prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { computeCompatibility } = require('../services/llm.service');

const router = express.Router();

function serializeListing(listing) {
  return { ...listing, photos: JSON.parse(listing.photos || '[]') };
}

// POST /api/listings (owner creates a listing)
router.post('/', authenticate, authorize('OWNER'), async (req, res) => {
  try {
    const { location, rent, availableFrom, roomType, furnishingStatus, photos } = req.body;
    if (!location || !rent || !availableFrom || !roomType || !furnishingStatus) {
      return res.status(400).json({ error: 'location, rent, availableFrom, roomType, furnishingStatus are required' });
    }
    const listing = await prisma.listing.create({
      data: {
        ownerId: req.user.id,
        location,
        rent: Number(rent),
        availableFrom: new Date(availableFrom),
        roomType,
        furnishingStatus,
        photos: JSON.stringify(Array.isArray(photos) ? photos : []),
      },
    });
    res.status(201).json({ listing: serializeListing(listing) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// GET /api/listings/mine (owner's own listings)
router.get('/mine', authenticate, authorize('OWNER'), async (req, res) => {
  const listings = await prisma.listing.findMany({
    where: { ownerId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ listings: listings.map(serializeListing) });
});

// GET /api/listings (tenant browses + filters; ranked by compatibility score)
// Query params: location, budgetMax
router.get('/', authenticate, authorize('TENANT'), async (req, res) => {
  try {
    const { location, budgetMax } = req.query;

    const profile = await prisma.tenantProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) {
      return res.status(400).json({ error: 'Please complete your tenant profile before browsing listings' });
    }

    const where = { status: 'ACTIVE' };
    if (location) where.location = { contains: String(location) };
    if (budgetMax) where.rent = { lte: Number(budgetMax) };

    const listings = await prisma.listing.findMany({
      where,
      include: { owner: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Ensure each listing has a stored compatibility score for this tenant;
    // compute (LLM with rule-based fallback) and persist if missing.
    const results = [];
    for (const listing of listings) {
      let compat = await prisma.compatibility.findUnique({
        where: { tenantId_listingId: { tenantId: req.user.id, listingId: listing.id } },
      });
      if (!compat) {
        const computed = await computeCompatibility(listing, profile);
        compat = await prisma.compatibility.create({
          data: {
            tenantId: req.user.id,
            listingId: listing.id,
            score: computed.score,
            explanation: computed.explanation,
            source: computed.source,
          },
        });
      }
      results.push({ ...serializeListing(listing), compatibility: compat });
    }

    results.sort((a, b) => b.compatibility.score - a.compatibility.score);
    res.json({ listings: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// GET /api/listings/:id
router.get('/:id', authenticate, async (req, res) => {
  const listing = await prisma.listing.findUnique({
    where: { id: req.params.id },
    include: { owner: { select: { id: true, name: true, email: true } } },
  });
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  res.json({ listing: serializeListing(listing) });
});

// PATCH /api/listings/:id (owner edits their own listing)
router.patch('/:id', authenticate, authorize('OWNER'), async (req, res) => {
  try {
    const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.ownerId !== req.user.id) return res.status(403).json({ error: 'Not your listing' });

    const { location, rent, availableFrom, roomType, furnishingStatus, photos } = req.body;
    const updated = await prisma.listing.update({
      where: { id: req.params.id },
      data: {
        ...(location && { location }),
        ...(rent != null && { rent: Number(rent) }),
        ...(availableFrom && { availableFrom: new Date(availableFrom) }),
        ...(roomType && { roomType }),
        ...(furnishingStatus && { furnishingStatus }),
        ...(photos && { photos: JSON.stringify(photos) }),
      },
    });
    res.json({ listing: serializeListing(updated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update listing' });
  }
});

// PATCH /api/listings/:id/fill (owner marks listing as filled -> hidden from search)
router.patch('/:id/fill', authenticate, authorize('OWNER'), async (req, res) => {
  const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.ownerId !== req.user.id) return res.status(403).json({ error: 'Not your listing' });

  const updated = await prisma.listing.update({ where: { id: req.params.id }, data: { status: 'FILLED' } });
  res.json({ listing: serializeListing(updated) });
});

module.exports = router;
