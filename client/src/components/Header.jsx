import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/Header.css";

export default function Header({ isAuthenticated = false }) {
  const nav = useNavigate();
  const location = useLocation();

  const handleSignOut = () => {
    // TODO: Clear authentication state
    nav("/");
  };

  return (
    <header className="site-header">
      <div className="header-content">
        <div className="header-brand" onClick={() => nav("/")}>
          <div className="brand-ornament"></div>
          <h1 className="brand-name">Domus Memoriae</h1>
          <p className="brand-tagline">Preserve Your Legacy</p>
        </div>

        <nav className="header-nav">
          {isAuthenticated ? (
            <>
              <button 
                className={`nav-link ${location.pathname === "/dashboard" ? "active" : ""}`}
                onClick={() => nav("/dashboard")}
              >
                Dashboard
              </button>
              <button 
                className="nav-link"
                onClick={() => nav("/vault")}
              >
                Vault
              </button>
              <button 
                className="nav-link nav-link-secondary"
                onClick={handleSignOut}
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <button 
                className="nav-link"
                onClick={() => nav("/login")}
              >
                Sign In
              </button>
              <button 
                className="nav-link nav-link-primary"
                onClick={() => nav("/register")}
              >
                Create Account
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
