import React, { useState } from "react";
import API_BASE_URL from "../api";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/CreateVault.css";

export default function CreateVault() {
  const nav = useNavigate();
  const [formData, setFormData] = useState({ vaultName: "", description: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCreateVault = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/vault/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", 
        body: JSON.stringify({ 
          vaultName: formData.vaultName, 
          description: formData.description 
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      localStorage.setItem("currentVaultId", data.id); 
      nav(`/vault/${data.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Header isAuthenticated={true} />
      <div className="create-vault">
        <div className="background-grain"></div>
        <div className="background-vignette"></div>

        <div className="create-vault-container">
          <div className="create-vault-card">
            <header className="create-vault-header">
              <div className="header-ornament"></div>
              <h1 className="create-vault-title">Create Family Vault</h1>
              <p className="create-vault-subtitle">Establish a new archive for your family's memories</p>
            </header>

            {error && (
              <div className="form-error">{error}</div>
            )}

            <form className="create-vault-form" onSubmit={handleCreateVault}>
              <div className="form-group">
                <label className="form-label" htmlFor="vaultName">
                  Vault Name <span className="required">*</span>
                </label>
                <input 
                  type="text"
                  id="vaultName"
                  className="form-input" 
                  placeholder="Smith Family Archive"
                  value={formData.vaultName}
                  onChange={(e) => setFormData({...formData, vaultName: e.target.value})} 
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="description">Description</label>
                <textarea 
                  id="description"
                  className="form-textarea" 
                  placeholder="A place to preserve our family's stories and memories..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  disabled={isLoading}
                  rows="4"
                />
              </div>

              <div className="form-actions">
                <button 
                  type="submit" 
                  className="submit-button"
                  disabled={isLoading}
                >
                  <span className="button-text">
                    {isLoading ? "Creating..." : "Create Vault"}
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