/**
 * compatibility scoring via LLM (Anthropic Claude), with a deterministic
 * rule-based fallback if the LLM is unavailable, mis-configured, or errors out.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

function buildPrompt(listing, tenantProfile) {
  return `Given this room listing: ${JSON.stringify({
    location: listing.location,
    rent: listing.rent,
    availableFrom: listing.availableFrom,
    roomType: listing.roomType,
    furnishingStatus: listing.furnishingStatus,
  })} and this tenant profile: ${JSON.stringify({
    preferredLocation: tenantProfile.preferredLocation,
    budgetMin: tenantProfile.budgetMin,
    budgetMax: tenantProfile.budgetMax,
    moveInDate: tenantProfile.moveInDate,
  })}, compute a compatibility score from 0 to 100 based on budget and location match. Return JSON: { score: number, explanation: string }. Respond with ONLY the JSON object, no markdown, no extra text.`;
}

// Simple, transparent rule-based scorer used as a fallback.
function ruleBasedScore(listing, tenantProfile) {
  let score = 0;
  const reasons = [];

  // Location match (case-insensitive substring match in either direction)
  const tLoc = (tenantProfile.preferredLocation || '').toLowerCase().trim();
  const lLoc = (listing.location || '').toLowerCase().trim();
  if (tLoc && lLoc && (lLoc.includes(tLoc) || tLoc.includes(lLoc))) {
    score += 50;
    reasons.push('location matches tenant preference');
  } else {
    reasons.push('location does not match tenant preference');
  }

  // Budget match
  const rent = listing.rent;
  if (rent >= tenantProfile.budgetMin && rent <= tenantProfile.budgetMax) {
    score += 50;
    reasons.push('rent is within tenant budget range');
  } else {
    const mid = (tenantProfile.budgetMin + tenantProfile.budgetMax) / 2;
    const diffRatio = Math.abs(rent - mid) / Math.max(mid, 1);
    const partial = Math.max(0, 50 - Math.round(diffRatio * 50));
    score += partial;
    reasons.push(
      rent > tenantProfile.budgetMax
        ? 'rent exceeds tenant budget'
        : 'rent is below tenant budget (still may be a partial fit)'
    );
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const explanation = `Rule-based fallback score: ${reasons.join('; ')}.`;
  return { score, explanation, source: 'RULE_BASED' };
}

async function computeCompatibility(listing, tenantProfile) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return ruleBasedScore(listing, tenantProfile);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022',
        max_tokens: 300,
        messages: [{ role: 'user', content: buildPrompt(listing, tenantProfile) }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`LLM API responded with status ${response.status}`);

    const data = await response.json();
    const text = (data.content || []).map((b) => b.text || '').join('').trim();
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    let score = Number(parsed.score);
    if (!Number.isFinite(score)) throw new Error('LLM returned a non-numeric score');
    score = Math.max(0, Math.min(100, Math.round(score)));

    const explanation = String(parsed.explanation || 'No explanation provided.');
    return { score, explanation, source: 'LLM' };
  } catch (err) {
    console.error('[llm.service] Falling back to rule-based scoring:', err.message);
    return ruleBasedScore(listing, tenantProfile);
  }
}

module.exports = { computeCompatibility, ruleBasedScore };
