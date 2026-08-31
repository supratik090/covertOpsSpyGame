import React, { useState } from 'react';
import { Key, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { AUTH_API_BASE } from '../config';
import { fetchWithRetry } from '../utils/api';
import RetrySpinner from './RetrySpinner';

const LoginScreen = ({ onLoginSuccess }) => {
  const [loginMode, setLoginMode] = useState('LOGIN');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');
  const [retryState, setRetryState] = useState(null);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoginError('');
    setRegisterSuccess('');

    const payload = { username, password };

    try {
      const onRetry = (a, m) => setRetryState({ attempt: a, max: m });
      if (loginMode === 'LOGIN') {
        const res = await fetchWithRetry(`${AUTH_API_BASE}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }, onRetry);
        setRetryState(null);

        if (res.ok) {
          const data = await res.json();
          localStorage.setItem('covert_ops_operator_user', data.username);
          localStorage.setItem('spy_game_token', data.token);
          onLoginSuccess();
        } else {
          const errText = await res.text();
          let errMsg = 'INVALID CREDENTIALS';
          try {
            const errJson = JSON.parse(errText);
            errMsg = errJson.message || errJson.error || errMsg;
          } catch (e) {
            errMsg = errText || errMsg;
          }
          setLoginError(errMsg.toUpperCase());
        }
      } else {
        const res = await fetchWithRetry(`${AUTH_API_BASE}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }, onRetry);
        setRetryState(null);

        if (res.ok) {
          setRegisterSuccess('OPERATOR ID REGISTERED. PROCEED TO LOGIN.');
          setLoginMode('LOGIN');
          setPassword('');
        } else {
          const errText = await res.text();
          let errMsg = 'OPERATOR REGISTRATION REJECTED';
          try {
            const errJson = JSON.parse(errText);
            errMsg = errJson.message || errJson.error || errMsg;
          } catch (e) {
            errMsg = errText || errMsg;
          }
          setLoginError(errMsg.toUpperCase());
        }
      }
    } catch (err) {
      console.error(err);
      setLoginError('CONNECTION TO CLEARANCE DATABASE FAILED');
    }
  };

  return (
    <div className="auth-screen">
      {retryState && <RetrySpinner attempt={retryState.attempt} max={retryState.max} />}
      <motion.div 
        className="auth-card cyber-panel"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="auth-header">
          <Key className="auth-icon" size={48} />
          <h1 className="auth-title">SHADOW PROTOCOL</h1>
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
