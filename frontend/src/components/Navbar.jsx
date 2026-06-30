import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const home = user?.role === 'TENANT' ? '/tenant' : user?.role === 'OWNER' ? '/owner' : '/admin';

  return (
    <div className="navbar">
      <Link to={user ? home : '/login'} className="brand">
        🏠 Rent & Flatmate Finder
      </Link>
      <nav>
        {user && (
          <>
            {user.role === 'TENANT' && <Link to="/tenant">Browse</Link>}
            {user.role === 'OWNER' && <Link to="/owner">My Listings</Link>}
            {user.role === 'ADMIN' && <Link to="/admin">Dashboard</Link>}
            {(user.role === 'TENANT' || user.role === 'OWNER') && <Link to="/chat">Chat</Link>}
            <span className="muted">{user.name} ({user.role})</span>
            <button className="btn secondary" onClick={handleLogout}>
              Log out
            </button>
          </>
        )}
      </nav>
    </div>
  );
}
