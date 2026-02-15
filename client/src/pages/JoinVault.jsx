import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/JoinVault.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

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

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Failed to join vault");
      setIsSubmitting(false);
      return;
    }

    const vault = json.vault;
    localStorage.setItem("currentVaultId", vault.id);
    if (vault.joinCode) localStorage.setItem("vaultJoinCode", vault.joinCode);

    nav("/vault", { state: { vault } });
  } catch (err) {
    setError("Network error. Is the backend running?");
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
          <span className="join-vault-back-arrow">←</span>
          <span>Return to Dashboard</span>
        </button>

        <div className="join-vault-card">
          <div className="join-vault-header">
            <div className="join-vault-ornament"></div>
            <h1 className="join-vault-title">Join a Family Vault</h1>
            <p className="join-vault-subtitle">
              Enter the invitation code to access a shared archive
            </p>
          </div>

          {error && <div className="join-vault-error">{error}</div>}

          <form className="join-vault-form" onSubmit={handleJoinVault}>
            <div className="join-vault-field">
              <label className="join-vault-label" htmlFor="vaultCode">
                Vault Invitation Code
              </label>
              <input
                id="vaultCode"
                type="text"
                className="join-vault-input"
                placeholder="Enter 12-character code"
                value={vaultCode}
                onChange={(e) => setVaultCode(e.target.value.toUpperCase())}
                maxLength={12}
                required
              />
              <span className="join-vault-hint">
                Codes are case-insensitive and contain letters and numbers
              </span>
            </div>

            <div className="join-vault-info">
              <div className="join-vault-info-icon">ⓘ</div>
              <p className="join-vault-info-text">
                Once accepted, you'll have access to view and contribute to the
                family archive based on the permissions granted by the vault
                administrator.
              </p>
            </div>

            <div className="join-vault-actions">
              <button
                type="submit"
                disabled={isSubmitting}
                className="join-vault-button join-vault-button-primary"
              >
                <span className="join-vault-button-text">{isSubmitting ? "Joining..." : "Join Vault"}</span>
                <span className="join-vault-button-underline"></span>
              </button>

              <button
                type="button"
                className="join-vault-button join-vault-button-secondary"
                onClick={() => nav("/dashboard")}
              >
                <span className="join-vault-button-text">Cancel</span>
              </button>
            </div>
          </form>

          <div className="join-vault-divider">
            <span className="join-vault-divider-text">or</span>
          </div>

          <div className="join-vault-alternative">
            <p className="join-vault-alternative-text">
              Don't have an invitation code?
            </p>
            <button
              className="join-vault-link"
              onClick={() => nav("/create-vault")}
            >
              Create your own family vault
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}