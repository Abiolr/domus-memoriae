import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/JoinVault.css";

const API_BASE_URL = import.meta.env?.VITE_API_URL || "http://localhost:5000";

export default function JoinVault() {
  const nav = useNavigate();
  const [vaultCode, setVaultCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleJoinVault = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/vault/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: vaultCode.trim().toUpperCase() }),
      });

      const json = await res.json();
      
      if (!res.ok) {
        setError(json.error || "Failed to join vault");
        setIsSubmitting(false);
        return;
      }

      if (json.vault && json.vault.id) {
        localStorage.setItem("currentVaultId", json.vault.id);
        nav(`/vault/${json.vault.id}`);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err) {
      setError(err.message || "Network error. Ensure the backend is running.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Header isAuthenticated={true} />
      <div className="join-vault">
        <div className="background-grain"></div>
        <div className="background-vignette"></div>

        <div className="join-vault-container">
          <div className="join-vault-card">
            <header className="join-vault-header">
              <div className="header-ornament"></div>
              <h1 className="join-vault-title">Join a Family Vault</h1>
              <p className="join-vault-subtitle">Enter the invitation code provided by the administrator</p>
            </header>

            {error && (
              <div className="form-error">{error}</div>
            )}

            <form className="join-vault-form" onSubmit={handleJoinVault}>
              <div className="form-group">
                <label className="form-label" htmlFor="vaultCode">
                  Invitation Code <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="vaultCode"
                  className="form-input"
                  placeholder="ABCD1234EFGH"
                  value={vaultCode}
                  onChange={(e) => setVaultCode(e.target.value.toUpperCase())}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-actions">
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="submit-button"
                >
                  <span className="button-text">
                    {isSubmitting ? "Joining..." : "Join Vault"}
                  </span>
                  <span className="button-underline"></span>
                </button>

                <button 
                  type="button"
                  className="back-button" 
                  onClick={() => nav("/dashboard")}
                >
                  <span className="back-arrow">←</span>
                  <span>Return to dashboard</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
