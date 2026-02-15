import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "../assets/DM_logo.png";
import "../styles/Header.css";

export default function Header({ isAuthenticated = false }) {
  const nav = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    console.log("[DEBUG] Sign out clicked");
    try {
      const response = await fetch("http://localhost:5000/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      console.log("[DEBUG] Logout response:", response.status);
      localStorage.removeItem("currentVaultId");
      console.log("[DEBUG] Navigating to homepage");
      nav("/");
    } catch (err) {
      console.error("Logout failed:", err);
      // Navigate anyway
      localStorage.removeItem("currentVaultId");
      nav("/");
    }
  };

  const handleBrandClick = () => {
    if (location.pathname === "/") {
      // Smooth scroll to top if already on the homepage
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      // Navigate home and reset scroll to the top
      nav("/");
      window.scrollTo(0, 0);
    }
  };

  return (
    <header className="site-header">
      <div className="header-content">
        {/* BRAND (Logo + Text) */}
        <div className="header-brand" onClick={handleBrandClick}>
          <div className="brand-row">
            <img src={logo} alt="Domus Memoriae Logo" className="header-logo" />

            <div className="brand-text">
              <div className="brand-ornament"></div>
              <h1 className="brand-name">Domus Memoriae</h1>
              <p className="brand-tagline">Preserve Your Legacy</p>
            </div>
          </div>
        </div>

        {/* NAV */}
        <nav className="header-nav">
          {isAuthenticated ? (
            <>
              <button
                type="button"
                className={`nav-link ${
                  location.pathname === "/dashboard" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  console.log("Dashboard clicked");
                  nav("/dashboard");
                  window.scrollTo(0, 0);
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
                  window.scrollTo(0, 0);
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
                  window.scrollTo(0, 0);
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
