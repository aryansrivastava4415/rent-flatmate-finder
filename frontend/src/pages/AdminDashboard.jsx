import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

function ActivityTab() {
  const { token } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.adminActivity(token).then(setData);
  }, [token]);

  if (!data) return <div className="empty">Loading…</div>;

  const { summary, recentInterests } = data;

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card"><div className="value">{summary.userCount}</div><div className="label">Users</div></div>
        <div className="stat-card"><div className="value">{summary.listingCount}</div><div className="label">Listings</div></div>
        <div className="stat-card"><div className="value">{summary.activeListingCount}</div><div className="label">Active Listings</div></div>
        <div className="stat-card"><div className="value">{summary.interestCount}</div><div className="label">Interest Requests</div></div>
        <div className="stat-card"><div className="value">{summary.acceptedInterestCount}</div><div className="label">Accepted Matches</div></div>
        <div className="stat-card"><div className="value">{summary.messageCount}</div><div className="label">Chat Messages</div></div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Recent Interest Requests</h3>
        <table>
          <thead>
            <tr><th>Tenant</th><th>Listing</th><th>Status</th><th>Date</th></tr>
          </thead>
          <tbody>
            {recentInterests.map((i) => (
              <tr key={i.id}>
                <td>{i.tenant.name}</td>
                <td>{i.listing.location}</td>
                <td><span className={`badge status-${i.status.toLowerCase()}`}>{i.status}</span></td>
                <td className="muted">{new Date(i.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsersTab() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const data = await api.adminUsers(token);
    setUsers(data.users);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(u) {
    await api.adminToggleUser(token, u.id, !u.isActive);
    load();
  }

  if (loading) return <div className="empty">Loading…</div>;

  return (
    <div className="card">
      <h3>All Users</h3>
      <table>
        <thead>
          <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>
                <span className={`badge ${u.isActive ? 'status-accepted' : 'status-declined'}`}>
                  {u.isActive ? 'Active' : 'Disabled'}
                </span>
              </td>
              <td className="muted">{new Date(u.createdAt).toLocaleDateString()}</td>
              <td>
                {u.role !== 'ADMIN' && (
                  <button className="btn secondary" onClick={() => toggle(u)}>
                    {u.isActive ? 'Disable' : 'Enable'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListingsTab() {
  const { token } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.adminListings(token).then((d) => setListings(d.listings)).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="empty">Loading…</div>;

  return (
    <div className="card">
      <h3>All Listings</h3>
      <table>
        <thead>
          <tr><th>Location</th><th>Owner</th><th>Rent</th><th>Status</th><th>Posted</th></tr>
        </thead>
        <tbody>
          {listings.map((l) => (
            <tr key={l.id}>
              <td>{l.location}</td>
              <td>{l.owner.name}</td>
              <td>₹{l.rent}</td>
              <td><span className={`badge ${l.status === 'ACTIVE' ? 'status-accepted' : 'status-declined'}`}>{l.status}</span></td>
              <td className="muted">{new Date(l.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('activity');

  return (
    <div className="container">
      <h2>Admin Dashboard</h2>
      <div className="tabs">
        <button className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}>Activity</button>
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Users</button>
        <button className={tab === 'listings' ? 'active' : ''} onClick={() => setTab('listings')}>Listings</button>
      </div>
      {tab === 'activity' && <ActivityTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'listings' && <ListingsTab />}
    </div>
  );
}
