import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Dashboard.css";

export default function Dashboard() {
  const nav = useNavigate();

  return (
    <div className="dashboard">
      <div className="background-grain"></div>
      <div className="background-vignette"></div>
      
      <div className="content-wrapper">
        <header className="dashboard-header">
          <div className="header-ornament"></div>
          <h1 className="dashboard-title">Domus Memoriae</h1>
          <p className="dashboard-subtitle">Your Family Archive</p>
        </header>

        <main className="dashboard-main">
          <div className="vault-actions">
            <button 
              className="vault-button vault-button-primary" 
              onClick={() => nav("/join-vault")}
            >
              <span className="button-text">Join Vault</span>
              <span className="button-underline"></span>
            </button>

            <button 
              className="vault-button vault-button-primary" 
              onClick={() => nav("/create-vault")}
            >
              <span className="button-text">Create Vault</span>
              <span className="button-underline"></span>
            </button>
          </div>
        </main>

        <footer className="dashboard-footer">
          <button 
            className="logout-button" 
            onClick={() => nav("/")}
          >
            Sign Out
          </button>
        </footer>
      </div>
    </div>
  );
}
