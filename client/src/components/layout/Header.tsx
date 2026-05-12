import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';


const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const shopName = localStorage.getItem('shopName') || 'Khata Manager';
  const ownerName = localStorage.getItem('ownerName');

  // Hide header on signup page only
  if (["/signup"].includes(location.pathname)) {
    return null;
  }

  return (
    <header className="bg-blue-800 text-white shadow-lg p-4 flex justify-between items-center">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-bold">{shopName}</h1>
        {ownerName && <span className="text-sm bg-blue-700 px-2 py-1 rounded">Owner: {ownerName}</span>}
      </div>
    </header>
  );
};

export default Header;
