import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import api from '../api';

const ProtectedRoute: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await api.get('/auth/me');
        setAuthenticated(true);
      } catch (err) {
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return authenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
