import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/Dashboard.css";

export default function Dashboard() {
  const nav = useNavigate();

  useEffect(() => {
    const currentVaultId = localStorage.getItem("currentVaultId");
    if (currentVaultId) {
      nav(`/vault/${currentVaultId}`);
    }
  }, [nav]);

  return (
    <>
      <Header isAuthenticated={true} />
      <div className="dashboard">
        <div className="background-grain"></div>
        <div className="background-vignette"></div>
        <div className="content-wrapper">
          <main className="dashboard-main">
             <div className="vault-actions">
              {/* Dashboard now only serves as the choice between Join and Create */}
              <button className="vault-button vault-button-primary" onClick={() => nav("/join-vault")}>
                Join Vault
              </button>
              <button className="vault-button vault-button-primary" onClick={() => nav("/create-vault")}>
                Create Vault
              </button>
            </div>
          </main>
        </div>
      </div>
      <Footer />
    </>
  );
}