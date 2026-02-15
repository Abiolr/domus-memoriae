import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/JoinVault.css";

const API_BASE_URL = import.meta.env?.VITE_API_URL || "http://localhost:5000";

export default function JoinVault() {
  const nav = useNavigate();
  const [vaultCode, setVaultCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatCode = (input) => {
    // Remove non-alphanumeric and convert to uppercase
    const cleaned = input.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    // Add hyphens every 4 characters
    const formatted = cleaned.match(/.{1,4}/g)?.join("-") || cleaned;
    return formatted;
  };

  const handleInputChange = (e) => {
    const formatted = formatCode(e.target.value);
    setVaultCode(formatted);
    setError("");
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    const formatted = formatCode(pasted);
    setVaultCode(formatted);
    setError("");
  };

  const handleJoinVault = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    // Remove hyphens before sending
    const cleanCode = vaultCode.replace(/-/g, "");

    if (!cleanCode || cleanCode.length < 8) {
      setError("Please enter a valid invitation code");
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/vault/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: cleanCode }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Failed to join vault");
        setIsSubmitting(false);
        return;
      }

      // Success!
      if (json.vault && json.vault.id) {
        localStorage.setItem("currentVaultId", json.vault.id);
        nav(`/vault/${json.vault.id}`);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err) {
      setError(err.message || "Network error. Ensure the backend is running.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="join-vault">
      <div className="background-grain"></div>
      <div className="background-vignette"></div>

      <div className="join-vault-container">
        <div className="join-vault-card">
          <div className="join-vault-header">
            <div className="header-ornament"></div>
            <h1 className="join-vault-title">Join a Family Vault</h1>
            <p className="join-vault-subtitle">
              Enter the invitation code provided by the vault's administrator
            </p>
          </div>

          <form className="join-vault-form" onSubmit={handleJoinVault}>
            {error && <div className="form-error">{error}</div>}

            <div className="form-group">
              <label className="form-label">
                Invitation Code <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="XXXX-XXXX-XXXX"
                value={vaultCode}
                onChange={handleInputChange}
                onPaste={handlePaste}
                required
                disabled={isSubmitting}
                maxLength={14}
                autoFocus
              />
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="submit-button"
                disabled={isSubmitting || !vaultCode}
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
                disabled={isSubmitting}
              >
                <span className="back-arrow">←</span>
                Return to Dashboard
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
