import React, { useState } from 'react';
import api from '../api';

interface AuthProps {
  onLogin: (shop: any) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const response = await api.post('/auth/login', { email, password });
        const { token, shop } = response.data;
        localStorage.setItem('token', token);
        localStorage.setItem('shop', JSON.stringify(shop));
        onLogin(shop);
      } else {
        await api.post('/auth/signup', { 
          email, 
          password, 
          shop_name: shopName, 
          owner_name: ownerName 
        });
        alert('Account created successfully! Please login.');
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>{isLogin ? 'Welcome Back' : 'Create Shop'}</h1>
        <p className="auth-subtitle">
          {isLogin ? 'Login to manage your Khata' : 'Start managing your shop digitally'}
        </p>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <div className="input-group">
                <label>Shop Name</label>
                <input 
                  type="text" 
                  value={shopName} 
                  onChange={(e) => setShopName(e.target.value)} 
                  placeholder="e.g. Sharma General Store"
                  required 
                />
              </div>
              <div className="input-group">
                <label>Owner Name</label>
                <input 
                  type="text" 
                  value={ownerName} 
                  onChange={(e) => setOwnerName(e.target.value)} 
                  placeholder="Your full name"
                  required 
                />
              </div>
            </>
          )}

          <div className="input-group">
            <label>Email Address</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="name@company.com"
              required 
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="••••••••"
              required 
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Create Account')}
          </button>
        </form>

        <div className="auth-toggle">
          {isLogin ? "Don't have a shop?" : "Already have a shop?"}
          <button onClick={() => setIsLogin(!isLogin)} className="toggle-link">
            {isLogin ? ' Register Now' : ' Login here'}
          </button>
        </div>
      </div>

      <style>{`
        .auth-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }
        .auth-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          padding: 40px;
          border-radius: 24px;
          width: 100%;
          max-width: 450px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.2);
          text-align: center;
        }
        h1 { margin-bottom: 8px; color: #1a202c; font-size: 28px; font-weight: 800; }
        .auth-subtitle { color: #718096; margin-bottom: 32px; font-size: 14px; }
        .input-group { text-align: left; margin-bottom: 20px; }
        .input-group label { display: block; margin-bottom: 8px; font-size: 14px; font-weight: 600; color: #4a5568; }
        .input-group input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          font-size: 16px;
          transition: all 0.2s;
          box-sizing: border-box;
        }
        .input-group input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        .error-message { color: #e53e3e; font-size: 14px; margin-bottom: 16px; text-align: left; }
        .auth-button {
          width: 100%;
          padding: 14px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.1s, background 0.2s;
        }
        .auth-button:hover { background: #5a67d8; }
        .auth-button:active { transform: scale(0.98); }
        .auth-button:disabled { opacity: 0.7; cursor: not-allowed; }
        .auth-toggle { margin-top: 24px; font-size: 14px; color: #718096; }
        .toggle-link {
          background: none;
          border: none;
          color: #667eea;
          font-weight: 700;
          cursor: pointer;
          padding: 0;
          margin-left: 4px;
        }
        .toggle-link:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
};

export default Auth;
