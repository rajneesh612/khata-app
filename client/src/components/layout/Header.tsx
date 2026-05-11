import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../api';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const shopName = localStorage.getItem('shopName') || 'Khata Manager';
  const ownerName = localStorage.getItem('ownerName');

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
      localStorage.removeItem('shopName');
      localStorage.removeItem('ownerName');
      navigate('/login');
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  // Hide header on login/signup pages
  if (['/login', '/signup'].includes(location.pathname)) {
    return null;
  }

  return (
    <header className="bg-blue-800 text-white shadow-lg p-4 flex justify-between items-center">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-bold">{shopName}</h1>
        {ownerName && <span className="text-sm bg-blue-700 px-2 py-1 rounded">Owner: {ownerName}</span>}
      </div>
      <div className="flex items-center space-x-4">
        <button 
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm font-semibold transition"
        >
          Logout
        </button>
      </div>
    </header>
  );
};

export default Header;
