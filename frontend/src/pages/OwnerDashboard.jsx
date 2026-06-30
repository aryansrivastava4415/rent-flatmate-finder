import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

function scoreClass(score) {
  if (score == null) return '';
  if (score >= 80) return 'score-high';
  if (score >= 50) return 'score-mid';
  return 'score-low';
}

function CreateListingTab({ onCreated }) {
  const { token } = useAuth();
  const [form, setForm] = useState({
    location: '',
    rent: '',
    availableFrom: '',
    roomType: 'PRIVATE',
    furnishingStatus: 'FURNISHED',
    photosText: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const photos = form.photosText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await api.createListing(token, { ...form, photos });
      setSuccess('Listing created successfully!');
      setForm({ location: '', rent: '', availableFrom: '', roomType: 'PRIVATE', furnishingStatus: 'FURNISHED', photosText: '' });
      onCreated?.();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <h3>Post a new room listing</h3>
      {error && <div className="error-box">{error}</div>}
      {success && <div className="badge score-high" style={{ display: 'block', marginBottom: 14 }}>{success}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Location</label>
          <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Rent (₹/mo)</label>
            <input type="number" required value={form.rent} onChange={(e) => setForm({ ...form, rent: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Available from</label>
            <input
              type="date"
              required
              value={form.availableFrom}
              onChange={(e) => setForm({ ...form, availableFrom: e.target.value })}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Room type</label>
            <select value={form.roomType} onChange={(e) => setForm({ ...form, roomType: e.target.value })}>
              <option value="PRIVATE">Private</option>
              <option value="SHARED">Shared</option>
              <option value="STUDIO">Studio</option>
            </select>
          </div>
          <div className="form-group">
            <label>Furnishing</label>
            <select value={form.furnishingStatus} onChange={(e) => setForm({ ...form, furnishingStatus: e.target.value })}>
              <option value="FURNISHED">Furnished</option>
              <option value="SEMI_FURNISHED">Semi-furnished</option>
              <option value="UNFURNISHED">Unfurnished</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Photo URLs (comma-separated, optional)</label>
          <input
            value={form.photosText}
            onChange={(e) => setForm({ ...form, photosText: e.target.value })}
            placeholder="https://example.com/photo1.jpg, https://example.com/photo2.jpg"
          />
        </div>
        <button className="btn">Post listing</button>
      </form>
    </div>
  );
}

function MyListingsTab({ listings, loading, onFilled }) {
  const { token } = useAuth();

  async function handleFill(id) {
    await api.markFilled(token, id);
    onFilled();
  }

  if (loading) return <div className="empty">Loading…</div>;
  if (listings.length === 0) return <div className="empty">You haven't posted any listings yet.</div>;

  return (
    <div className="grid">
      {listings.map((l) => (
        <div className="card" key={l.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h4 style={{ margin: '0 0 4px' }}>{l.location}</h4>
            <span className={`badge ${l.status === 'ACTIVE' ? 'status-accepted' : 'status-declined'}`}>{l.status}</span>
          </div>
          <p className="muted">₹{l.rent}/mo · {l.roomType} · {l.furnishingStatus.replace('_', ' ')}</p>
          <p className="muted">Available from {new Date(l.availableFrom).toLocaleDateString()}</p>
          {l.status === 'ACTIVE' && (
            <button className="btn secondary" onClick={() => handleFill(l.id)} style={{ width: '100%', marginTop: 8 }}>
              Mark as filled
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function ReceivedInterestsTab() {
  const { token } = useAuth();
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api.receivedInterests(token);
      setInterests(data.interests);
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

  async function respond(id, status) {
    try {
      await api.respondInterest(token, id, status);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="empty">Loading…</div>;
  if (interests.length === 0) return <div className="empty">No interest requests yet.</div>;

  return (
    <div>
      {error && <div className="error-box">{error}</div>}
      <div className="grid">
        {interests.map((i) => (
          <div className="card" key={i.id}>
            <h4 style={{ margin: '0 0 4px' }}>{i.tenant.name}</h4>
            <p className="muted">Interested in: {i.listing.location} · ₹{i.listing.rent}/mo</p>
            {i.compatScore != null && <span className={`badge ${scoreClass(i.compatScore)}`}>{i.compatScore}/100 compatibility</span>}
            <div style={{ marginTop: 10 }}>
              <span className={`badge status-${i.status.toLowerCase()}`}>{i.status}</span>
            </div>
            {i.status === 'PENDING' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn success" onClick={() => respond(i.id, 'ACCEPTED')}>
                  Accept
                </button>
                <button className="btn danger" onClick={() => respond(i.id, 'DECLINED')}>
                  Decline
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OwnerDashboard() {
  const { token } = useAuth();
  const [tab, setTab] = useState('listings');
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadListings() {
    setLoading(true);
    const data = await api.myListings(token);
    setListings(data.listings);
    setLoading(false);
  }

  useEffect(() => {
    loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container">
      <h2>Manage your listings</h2>
      <div className="tabs">
        <button className={tab === 'listings' ? 'active' : ''} onClick={() => setTab('listings')}>
          My Listings
        </button>
        <button className={tab === 'create' ? 'active' : ''} onClick={() => setTab('create')}>
          Post a Listing
        </button>
        <button className={tab === 'interests' ? 'active' : ''} onClick={() => setTab('interests')}>
          Interest Requests
        </button>
      </div>
      {tab === 'listings' && <MyListingsTab listings={listings} loading={loading} onFilled={loadListings} />}
      {tab === 'create' && <CreateListingTab onCreated={() => { loadListings(); setTab('listings'); }} />}
      {tab === 'interests' && <ReceivedInterestsTab />}
    </div>
  );
}
