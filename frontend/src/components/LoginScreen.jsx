import React, { useState } from 'react';
import { Key, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { AUTH_API_BASE } from '../config';

const LoginScreen = ({ onLoginSuccess }) => {
  const [loginMode, setLoginMode] = useState('LOGIN');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoginError('');
    setRegisterSuccess('');

    const payload = { username, password };

    try {
      if (loginMode === 'LOGIN') {
        const res = await fetch(`${AUTH_API_BASE}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const data = await res.json();
          localStorage.setItem('covert_ops_operator_user', data.username);
          onLoginSuccess();
        } else {
          const errText = await res.text();
          setLoginError(errText || 'INVALID CREDENTIALS');
        }
      } else {
        const res = await fetch(`${AUTH_API_BASE}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          setRegisterSuccess('OPERATOR ID REGISTERED. PROCEED TO LOGIN.');
          setLoginMode('LOGIN');
          setPassword('');
        } else {
          const errText = await res.text();
          setLoginError(errText || 'OPERATOR REGISTRATION REJECTED');
        }
      }
    } catch (err) {
      console.error(err);
      setLoginError('CONNECTION TO CLEARANCE DATABASE FAILED');
    }
  };

  return (
    <div className="auth-screen">
      <motion.div 
        className="auth-card cyber-panel"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="auth-header">
          <div className="auth-brand">
            <span className="auth-brand-line">PROTOCOL</span>
            <span className="auth-brand-name">NIGHTFALL</span>
          </div>
          <Key className="auth-icon" size={48} />
          <h1 className="auth-title">PROTOCOL NIGHTFALL</h1>
          <p className="auth-subtitle">CLEARANCE TERMINAL — AUTHENTICATE TO OPERATE</p>
        </div>

        <div className="auth-tabs">
          <button 
            className={`auth-tab ${loginMode === 'LOGIN' ? 'active' : ''}`}
            onClick={() => setLoginMode('LOGIN')}
          >
            LOGIN
          </button>
          <button 
            className={`auth-tab ${loginMode === 'REGISTER' ? 'active' : ''}`}
            onClick={() => setLoginMode('REGISTER')}
          >
            REGISTER
          </button>
        </div>

        <form className="auth-form" onSubmit={handleAuth}>
          <div className="form-field">
            <label className="form-label">OPERATOR ID</label>
            <input 
              type="text" 
              className="cyber-input" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required 
            />
          </div>
          <div className="form-field">
            <label className="form-label">PASSPHRASE</label>
            <input 
              type="password" 
              className="cyber-input" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          {loginError && <div className="auth-error">{loginError}</div>}
          {registerSuccess && <div className="auth-success">{registerSuccess}</div>}

          <button type="submit" className="cyber-btn lg">
            <Play size={20} />
            <span>{loginMode === 'LOGIN' ? 'AUTHENTICATE' : 'ENROLL'}</span>
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default LoginScreen;
