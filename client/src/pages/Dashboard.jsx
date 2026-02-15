import React from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/Dashboard.css";

export default function Dashboard() {
  const nav = useNavigate();

  return (
    <>
      <Header isAuthenticated={true} />
      <div className="dashboard">
        <div className="background-grain"></div>
        <div className="background-vignette"></div>
        
        <div className="content-wrapper">
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
        </div>
      </div>
      <Footer />
    </>
  );
}
