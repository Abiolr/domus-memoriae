import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Login.css";

export default function Login() {
  const nav = useNavigate();

  return (
    <div className="login">
      <div className="background-grain"></div>
      <div className="background-vignette"></div>
      
      <div className="login-container">
        <div className="login-card">
          <header className="login-header">
            <div className="header-ornament"></div>
            <h1 className="login-title">Domus Memoriae</h1>
            <p className="login-subtitle">Enter the Archive</p>
          </header>

          <form className="login-form" onSubmit={(e) => { e.preventDefault(); nav("/dashboard"); }}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input 
                className="form-input" 
                type="email" 
                id="email" 
                placeholder="your.email@example.com"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input 
                className="form-input" 
                type="password" 
                id="password" 
                placeholder="Enter your password"
                required
              />
            </div>

            <button type="submit" className="login-button">
              <span className="button-text">Enter Archive</span>
              <span className="button-underline"></span>
            </button>

            <div className="form-footer">
              <a href="#" className="forgot-link">Forgotten your key?</a>
            </div>
          </form>

          <div className="login-divider">
            <span className="divider-text">or</span>
          </div>

          <button 
            className="back-button" 
            onClick={() => nav("/")}
          >
            <span className="back-arrow">←</span>
            <span>Return to entrance</span>
          </button>
        </div>
      </div>
    </div>
  );
}
