import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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
      const response = await fetch("http://localhost:5000/api/vault/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", 
        body: JSON.stringify({ vaultName: formData.vaultName, description: formData.description }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      localStorage.setItem("currentVaultId", data.id); 
      nav(`/vault/${data.id}`); // Fixed dynamic route
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="create-vault">
      <div className="create-vault-grain"></div>
      <div className="create-vault-vignette"></div>
      <div className="create-vault-container">
        <button className="create-vault-back" onClick={() => nav("/dashboard")}>← Return</button>
        <div className="create-vault-card">
          <div className="create-vault-header">
            <div className="create-vault-ornament"></div>
            <h1 className="create-vault-title">Create Family Vault</h1>
          </div>
          <form className="create-vault-form" onSubmit={handleCreateVault}>
            {error && <div className="create-vault-error" style={{color: 'red'}}>{error}</div>}
            <div className="create-vault-field">
              <label className="create-vault-label">Vault Name</label>
              <input 
                className="create-vault-input" 
                name="vaultName" 
                onChange={(e) => setFormData({...formData, vaultName: e.target.value})} 
                required 
              />
            </div>
            <div className="create-vault-field">
              <label className="create-vault-label">Description</label>
              <textarea 
                className="create-vault-textarea" 
                name="description" 
                onChange={(e) => setFormData({...formData, description: e.target.value})} 
              />
            </div>
            <div className="create-vault-actions">
              <button type="submit" className="create-vault-button create-vault-button-primary">Create Vault</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}