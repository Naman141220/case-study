import React, { useState, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../UserContext'; // Import UserContext
import './styles/Login.css';  // Import the CSS file

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [showForgotPasswordForm, setShowForgotPasswordForm] = useState(false);
  const navigate = useNavigate();

  // Access context setters for userEmail, isAuthenticated, and isAdmin
  const { setUserEmail, setIsAdmin, setIsAuthenticated } = useContext(UserContext);

  // Login form submission handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post('http://localhost:9099/login', {
        email,
        password,
      });

      // Handle successful login
      console.log('Login successful:', response.data);

      // Store token in localStorage
      localStorage.setItem('token', response.data.token);
      
      // Update context with the user's email, authentication status, and admin status
      setUserEmail(email);
      setIsAuthenticated(true);
      setIsAdmin(response.data.isAdmin);

      // Redirect based on admin status
      navigate(response.data.isAdmin ? '/admindashboard' : '/loggedinloginpage', { replace: true });
    } catch (err) {
      setError('Invalid email or password');
      console.error('Login error:', err);
    }
  };

  // Forgot Password form submission handler
  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:9099/forgot-password', {
        email: forgotPasswordEmail,
      });

      setResetMessage(response.data.message);
    } catch (err) {
      setError('Failed to send password reset link');
      console.error('Forgot password error:', err);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2 style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Login</h2>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="inputGroup">
            <label htmlFor="email" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Email:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input"
            />
          </div>
          <div className="inputGroup">
            <label htmlFor="password" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Password:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input"
            />
          </div>
          <button type="submit" className="button" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
            Login
          </button>
        </form>

        {/* Forgot Password Link */}
        <p style={{ marginTop: '20px' }}>
          <button
            className="forgot-password-btn"
            onClick={() => setShowForgotPasswordForm(true)}
            style={{ fontFamily: 'Helvetica, Arial, sans-serif', color: '#1167E5', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Forgot Password?
          </button>
        </p>

        {/* Forgot Password Form */}
        {showForgotPasswordForm && (
          <form onSubmit={handleForgotPasswordSubmit}>
            <h3 style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Reset Password</h3>
            <div className="inputGroup">
              <label htmlFor="forgotPasswordEmail" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Enter your email:</label>
              <input
                type="email"
                id="forgotPasswordEmail"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                required
                className="input"
              />
            </div>
            <button type="submit" className="button" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
              Send Reset Link
            </button>
            {resetMessage && <p className="success">{resetMessage}</p>}
          </form>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
