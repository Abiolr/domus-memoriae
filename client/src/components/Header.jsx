import React from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/DM_logo.png";
import "../styles/Header.css";

export default function Header({ isAuthenticated = false }) {
  const nav = useNavigate();

  const handleSignOut = () => {
    nav("/");
  };

  return (
    <header className="site-header">
      <div className="header-content">
        {/* BRAND (left) */}
        <div className="header-brand" onClick={() => nav("/")}>
          <div className="brand-row">
            <img src={logo} alt="Domus Memoriae Logo" className="header-logo" />
            <div className="brand-text">
              <div className="brand-ornament"></div>
              <h1 className="brand-name">Domus Memoriae</h1>
              <p className="brand-tagline">Preserve Your Legacy</p>
            </div>
          </div>
        </div>

        {/* NAV (right) */}
        <nav className="header-nav">
          {isAuthenticated ? (
            <>
              <button className="nav-link" onClick={() => nav("/dashboard")}>
                Dashboard
              </button>
              <button className="nav-link" onClick={() => nav("/vault")}>
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
              <button className="nav-link" onClick={() => nav("/login")}>
                Login
              </button>
              <button
                className="nav-link nav-link-primary"
                onClick={() => nav("/register")}
              >
                Register
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
