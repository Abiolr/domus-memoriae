import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/Header.css";

export default function Header({ isAuthenticated = false }) {
  const nav = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    console.log('[DEBUG] Sign out clicked');
    try {
      const response = await fetch("http://localhost:5000/api/auth/logout", { 
        method: "POST", 
        credentials: "include" 
      });
      console.log('[DEBUG] Logout response:', response.status);
      localStorage.removeItem("currentVaultId");
      console.log('[DEBUG] Navigating to homepage');
      nav("/");
    } catch (err) {
      console.error("Logout failed:", err);
      // Navigate anyway
      localStorage.removeItem("currentVaultId");
      nav("/");
    }
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
                type="button"
                className={`nav-link ${location.pathname === "/dashboard" ? "active" : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  console.log("Dashboard clicked");
                  nav("/dashboard");
                }}
              >
                Dashboard
              </button>
              <button 
                type="button"
                className="nav-link nav-link-secondary"
                onClick={(e) => {
                  e.preventDefault();
                  console.log("Sign out clicked");
                  handleSignOut();
                }}
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <button 
                type="button"
                className="nav-link"
                onClick={(e) => {
                  e.preventDefault();
                  console.log("Sign in clicked");
                  nav("/login");
                }}
              >
                Sign In
              </button>
              <button 
                type="button"
                className="nav-link nav-link-primary"
                onClick={(e) => {
                  e.preventDefault();
                  console.log("Create account clicked");
                  nav("/register");
                }}
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
