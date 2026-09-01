import React, { useState } from 'react';
import { Key, Play, Mail, ShieldAlert, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { AUTH_API_BASE } from '../config';
import { fetchWithRetry } from '../utils/api';
import RetrySpinner from './RetrySpinner';

const LoginScreen = ({ onLoginSuccess }) => {
  const [loginMode, setLoginMode] = useState('LOGIN'); // 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD'
  
  // Login & Register state
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');
  const [retryState, setRetryState] = useState(null);

  // Forgot Password state
  const [forgotStep, setForgotStep] = useState(1); // 1: Request OTP, 2: Submit OTP & Reset
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');

  const resetAllStates = () => {
    setLoginError('');
    setRegisterSuccess('');
    setForgotError('');
    setForgotMessage('');
  };

  const switchMode = (mode) => {
    resetAllStates();
    setLoginMode(mode);
    setUsername('');
    setEmail('');
    setPassword('');
    setForgotIdentifier('');
    setOtp('');
    setNewPassword('');
    setMaskedEmail('');
    setForgotStep(1);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    resetAllStates();

    const onRetry = (a, m) => setRetryState({ attempt: a, max: m });

    try {
      if (loginMode === 'LOGIN') {
        const payload = { username, password };
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
          } catch {
            errMsg = errText || errMsg;
          }
          setLoginError(errMsg.toUpperCase());
        }
      } else if (loginMode === 'REGISTER') {
        const payload = { username, email, password };
        const res = await fetchWithRetry(`${AUTH_API_BASE}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }, onRetry);
        setRetryState(null);

        if (res.ok) {
          setRegisterSuccess('OPERATOR ENROLLED SUCCESSFULLY. PROCEED TO LOGIN.');
          setLoginMode('LOGIN');
          setPassword('');
        } else {
          const errText = await res.text();
          let errMsg = 'OPERATOR REGISTRATION REJECTED';
          try {
            const errJson = JSON.parse(errText);
            errMsg = errJson.message || errJson.error || errMsg;
          } catch {
            errMsg = errText || errMsg;
          }
          setLoginError(errMsg.toUpperCase());
        }
      }
    } catch (err) {
      console.error(err);
      setLoginError('CONNECTION TO CLEARANCE DATABASE FAILED');
      setRetryState(null);
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    resetAllStates();

    if (!forgotIdentifier.trim()) {
      setForgotError('ENTER CLASSIFIED OPERATOR ID OR EMAIL');
      return;
    }

    const onRetry = (a, m) => setRetryState({ attempt: a, max: m });

    try {
      const res = await fetchWithRetry(`${AUTH_API_BASE}/forgot-password/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: forgotIdentifier })
      }, onRetry);
      setRetryState(null);

      if (res.ok) {
        const data = await res.json();
        setMaskedEmail(data.email || '');
        setForgotMessage(data.message || 'OTP CODE DISPATCHED');
        setForgotStep(2);
      } else {
        const errText = await res.text();
        let errMsg = 'OTP REQUEST FAILED';
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.message || errJson.error || errMsg;
        } catch {
          errMsg = errText || errMsg;
        }
        setForgotError(errMsg.toUpperCase());
      }
    } catch (err) {
      console.error(err);
      setForgotError('CONNECTION TO DISPATCH SERVICE FAILED');
      setRetryState(null);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    resetAllStates();

    if (!otp.trim() || !newPassword.trim()) {
      setForgotError('ENTER BOTH OTP PASSCODE AND NEW PASSPHRASE');
      return;
    }

    const onRetry = (a, m) => setRetryState({ attempt: a, max: m });

    try {
      const res = await fetchWithRetry(`${AUTH_API_BASE}/forgot-password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: forgotIdentifier,
          otp: otp.trim(),
          newPassword: newPassword.trim()
        })
      }, onRetry);
      setRetryState(null);

      if (res.ok) {
        setRegisterSuccess('PASSPHRASE RESET SUCCESSFUL. LOG IN WITH YOUR NEW CREDS.');
        setLoginMode('LOGIN');
        setUsername(forgotIdentifier);
        setPassword('');
        setForgotStep(1);
        setOtp('');
        setNewPassword('');
      } else {
        const errText = await res.text();
        let errMsg = 'PASSPHRASE RESET FAILED';
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.message || errJson.error || errMsg;
        } catch {
          errMsg = errText || errMsg;
        }
        setForgotError(errMsg.toUpperCase());
      }
    } catch (err) {
      console.error(err);
      setForgotError('CONNECTION TO RECOVERY SERVICE FAILED');
      setRetryState(null);
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
            onClick={() => switchMode('LOGIN')}
          >
            LOGIN
          </button>
          <button 
            className={`auth-tab ${loginMode === 'REGISTER' ? 'active' : ''}`}
            onClick={() => switchMode('REGISTER')}
          >
            REGISTER
          </button>
          <button 
            className={`auth-tab ${loginMode === 'FORGOT_PASSWORD' ? 'active' : ''}`}
            onClick={() => switchMode('FORGOT_PASSWORD')}
          >
            RECOVERY
          </button>
        </div>

        {loginMode !== 'FORGOT_PASSWORD' ? (
          <form className="auth-form" onSubmit={handleAuth} autoComplete="off">
            <div className="form-field">
              <label className="form-label">
                {loginMode === 'LOGIN' ? 'OPERATOR ID OR EMAIL' : 'OPERATOR ID'}
              </label>
              <input 
                type="text" 
                className="cyber-input" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                required 
              />
            </div>

            {loginMode === 'REGISTER' && (
              <div className="form-field">
                <label className="form-label">EMAIL ADDRESS</label>
                <input 
                  type="email" 
                  className="cyber-input" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  required 
                />
              </div>
            )}

            <div className="form-field">
              <label className="form-label">PASSPHRASE</label>
              <div className="password-input-wrapper">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  className="cyber-input" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required 
                />
                <button 
                  type="button" 
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide Passphrase' : 'Show Passphrase'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {loginMode === 'LOGIN' && (
              <button 
                type="button" 
                className="auth-link"
                onClick={() => switchMode('FORGOT_PASSWORD')}
              >
                FORGOT PASSPHRASE?
              </button>
            )}

            {loginError && <div className="auth-error">{loginError}</div>}
            {registerSuccess && <div className="auth-success">{registerSuccess}</div>}

            <button type="submit" className="cyber-btn lg">
              <Play size={20} />
              <span>{loginMode === 'LOGIN' ? 'AUTHENTICATE' : 'ENROLL OPERATOR'}</span>
            </button>
          </form>
        ) : (
          <div className="auth-form">
            {forgotStep === 1 ? (
              <form onSubmit={handleRequestOtp} className="auth-form" autoComplete="off">
                <div className="form-field">
                  <label className="form-label">OPERATOR ID OR REGISTERED EMAIL</label>
                  <input 
                    type="text" 
                    className="cyber-input" 
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    autoComplete="off"
                    required 
                  />
                </div>

                {forgotError && <div className="auth-error">{forgotError}</div>}

                <button type="submit" className="cyber-btn lg">
                  <Mail size={20} />
                  <span>DISPATCH OTP CODE</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="auth-form" autoComplete="off">
                {maskedEmail && (
                  <div className="auth-info">
                    OTP PASSCODE SENT TO: <strong>{maskedEmail}</strong>
                  </div>
                )}
                {forgotMessage && <div className="auth-success">{forgotMessage}</div>}

                <div className="form-field">
                  <label className="form-label">6-DIGIT OTP PASSCODE</label>
                  <input 
                    type="text" 
                    className="cyber-input" 
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    autoComplete="off"
                    required 
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">NEW PASSPHRASE</label>
                  <div className="password-input-wrapper">
                    <input 
                      type={showNewPassword ? 'text' : 'password'} 
                      className="cyber-input" 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      required 
                    />
                    <button 
                      type="button" 
                      className="password-toggle-btn"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      title={showNewPassword ? 'Hide Passphrase' : 'Show Passphrase'}
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {forgotError && <div className="auth-error">{forgotError}</div>}

                <button type="submit" className="cyber-btn lg">
                  <ShieldAlert size={20} />
                  <span>UPDATE PASSPHRASE</span>
                </button>

                <button 
                  type="button" 
                  className="auth-link"
                  style={{ alignSelf: 'center', marginTop: '4px' }}
                  onClick={() => { resetAllStates(); setForgotStep(1); }}
                >
                  <RefreshCw size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  RESEND CODE / CHANGE IDENTIFIER
                </button>
              </form>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default LoginScreen;
