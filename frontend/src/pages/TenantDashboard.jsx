import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

function scoreClass(score) {
  if (score >= 80) return 'score-high';
  if (score >= 50) return 'score-mid';
  return 'score-low';
}

function ProfileTab() {
  const { token } = useAuth();
  const [form, setForm] = useState({ preferredLocation: '', budgetMin: '', budgetMax: '', moveInDate: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getTenantProfile(token)
      .then((data) => {
        if (data.profile) {
          setForm({
            preferredLocation: data.profile.preferredLocation,
            budgetMin: data.profile.budgetMin,
            budgetMax: data.profile.budgetMax,
            moveInDate: data.profile.moveInDate.slice(0, 10),
          });
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.saveTenantProfile(token, form);
      setSuccess('Profile saved. Compatibility scores will be recalculated as you browse.');
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="empty">Loading profile…</div>;

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h3>My Profile</h3>
      {error && <div className="error-box">{error}</div>}
      {success && <div className="badge score-high" style={{ display: 'block', marginBottom: 14 }}>{success}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Preferred location</label>
          <input
            required
            value={form.preferredLocation}
            onChange={(e) => setForm({ ...form, preferredLocation: e.target.value })}
            placeholder="e.g. Koramangala, Bangalore"
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Budget min (₹/mo)</label>
            <input
              type="number"
              required
              value={form.budgetMin}
              onChange={(e) => setForm({ ...form, budgetMin: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Budget max (₹/mo)</label>
            <input
              type="number"
              required
              value={form.budgetMax}
              onChange={(e) => setForm({ ...form, budgetMax: e.target.value })}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Move-in date</label>
          <input
            type="date"
            required
            value={form.moveInDate}
            onChange={(e) => setForm({ ...form, moveInDate: e.target.value })}
          />
        </div>
        <button className="btn">Save profile</button>
      </form>
    </div>
  );
}

function BrowseTab() {
  const { token } = useAuth();
  const [listings, setListings] = useState([]);
  const [filters, setFilters] = useState({ location: '', budgetMax: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [interestedIds, setInterestedIds] = useState(new Set());

  async function load() {
    setLoading(true);
    setError('');
    try {
      const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const data = await api.browseListings(token, clean);
      setListings(data.listings);
      const mine = await api.myInterests(token);
      setInterestedIds(new Set(mine.interests.map((i) => i.listingId)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleInterest(listingId) {
    try {
      await api.expressInterest(token, listingId);
      setInterestedIds((prev) => new Set(prev).add(listingId));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="card">
        <div className="form-row" style={{ alignItems: 'flex-end' }}>
          <div className="form-group">
            <label>Location</label>
            <input
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              placeholder="Filter by location"
            />
          </div>
          <div className="form-group">
            <label>Max rent</label>
            <input
              type="number"
              value={filters.budgetMax}
              onChange={(e) => setFilters({ ...filters, budgetMax: e.target.value })}
              placeholder="e.g. 20000"
            />
          </div>
          <button className="btn" onClick={load}>
            Search
          </button>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {loading ? (
        <div className="empty">Loading listings…</div>
      ) : listings.length === 0 ? (
        <div className="empty">No listings match your criteria yet. Try widening your filters or complete your profile.</div>
      ) : (
        <div className="grid">
          {listings.map((l) => (
            <div className="card" key={l.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h4 style={{ margin: '0 0 4px' }}>{l.location}</h4>
                <span className={`badge ${scoreClass(l.compatibility.score)}`}>{l.compatibility.score}/100</span>
              </div>
              <p className="muted" style={{ margin: '4px 0' }}>
                ₹{l.rent}/mo · {l.roomType} · {l.furnishingStatus.replace('_', ' ')}
              </p>
              <p className="muted">Available from {new Date(l.availableFrom).toLocaleDateString()}</p>
              {l.photos.length > 0 && (
                <div className="photo-row">
                  {l.photos.map((p, i) => (
                    <img src={p} key={i} alt="room" onError={(e) => (e.target.style.display = 'none')} />
                  ))}
                </div>
              )}
              <p style={{ fontSize: 13, color: '#444', marginTop: 8 }}>{l.compatibility.explanation}</p>
              <p className="muted">Owner: {l.owner.name}</p>
              <button
                className="btn"
                disabled={interestedIds.has(l.id)}
                onClick={() => handleInterest(l.id)}
                style={{ width: '100%', marginTop: 8 }}
              >
                {interestedIds.has(l.id) ? 'Interest sent ✓' : 'Express interest'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MyInterestsTab() {
  const { token } = useAuth();
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .myInterests(token)
      .then((data) => setInterests(data.interests))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="empty">Loading…</div>;
  if (interests.length === 0) return <div className="empty">You haven't expressed interest in any listings yet.</div>;

  return (
    <div className="grid">
      {interests.map((i) => (
        <div className="card" key={i.id}>
          <h4 style={{ margin: '0 0 4px' }}>{i.listing.location}</h4>
          <p className="muted">₹{i.listing.rent}/mo · Owner: {i.listing.owner.name}</p>
          <span className={`badge status-${i.status.toLowerCase()}`}>{i.status}</span>
          {i.compatScore != null && <span className={`badge ${scoreClass(i.compatScore)}`} style={{ marginLeft: 6 }}>{i.compatScore}/100</span>}
        </div>
      ))}
    </div>
  );
}

export default function TenantDashboard() {
  const [tab, setTab] = useState('browse');

  return (
    <div className="container">
      <h2>Find your room</h2>
      <div className="tabs">
        <button className={tab === 'browse' ? 'active' : ''} onClick={() => setTab('browse')}>
          Browse Listings
        </button>
        <button className={tab === 'interests' ? 'active' : ''} onClick={() => setTab('interests')}>
          My Interests
        </button>
        <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>
          My Profile
        </button>
      </div>
      {tab === 'browse' && <BrowseTab />}
      {tab === 'interests' && <MyInterestsTab />}
      {tab === 'profile' && <ProfileTab />}
    </div>
  );
}
