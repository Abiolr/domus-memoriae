import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/JoinVault.css";

// Use environment variables or default to localhost
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

      // Check if vault object and id exist in response
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
    <div className="join-vault">
      <div className="join-vault-grain"></div>
      <div className="join-vault-vignette"></div>

      <div className="join-vault-container">
        <button className="join-vault-back" onClick={() => nav("/dashboard")}>
          ← Return to Dashboard
        </button>

        <div className="join-vault-card">
          <div className="join-vault-header">
            <div className="join-vault-ornament"></div>
            <h1 className="join-vault-title">Join a Family Vault</h1>
            <p className="join-vault-subtitle">Enter the invitation code provided by the administrator</p>
          </div>

          {error && <div className="join-vault-error" style={{color: '#ff4d4d', padding: '10px', backgroundColor: 'rgba(255,0,0,0.1)', borderRadius: '4px', marginBottom: '1rem'}}>{error}</div>}

          <form className="join-vault-form" onSubmit={handleJoinVault}>
            <div className="join-vault-field">
              <label className="join-vault-label">Invitation Code</label>
              <input
                type="text"
                className="join-vault-input"
                placeholder="Ex: ABCD-1234-EFGH"
                value={vaultCode}
                onChange={(e) => setVaultCode(e.target.value.toUpperCase())}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="join-vault-actions">
              <button type="submit" disabled={isSubmitting} className="join-vault-button join-vault-button-primary">
                {isSubmitting ? "Processing..." : "Join Vault"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}