import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/CreateVault.css";

export default function CreateVault() {
  const nav = useNavigate();
  const [formData, setFormData] = useState({
    vaultName: "",
    description: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleCreateVault = (e) => {
    e.preventDefault();
    // Add vault creation logic here
    nav("/vault");
  };

  return (
    <div className="create-vault">
      <div className="create-vault-grain"></div>
      <div className="create-vault-vignette"></div>

      <div className="create-vault-container">
        <button className="create-vault-back" onClick={() => nav("/dashboard")}>
          <span className="create-vault-back-arrow">←</span>
          <span>Return to Dashboard</span>
        </button>

        <div className="create-vault-card">
          <div className="create-vault-header">
            <div className="create-vault-ornament"></div>
            <h1 className="create-vault-title">Create Family Vault</h1>
            <p className="create-vault-subtitle">
              Establish a sanctuary for your family's memories
            </p>
          </div>

          <form className="create-vault-form" onSubmit={handleCreateVault}>
            <div className="create-vault-field">
              <label className="create-vault-label" htmlFor="vaultName">
                Vault Name
              </label>
              <input
                id="vaultName"
                name="vaultName"
                type="text"
                className="create-vault-input"
                placeholder="e.g., The Smith Family Archive"
                value={formData.vaultName}
                onChange={handleChange}
                required
              />
              <span className="create-vault-hint">
                Choose a meaningful name that represents your family legacy
              </span>
            </div>

            <div className="create-vault-field">
              <label className="create-vault-label" htmlFor="description">
                Description (Optional)
              </label>
              <textarea
                id="description"
                name="description"
                className="create-vault-textarea"
                placeholder="Share the story behind this archive..."
                value={formData.description}
                onChange={handleChange}
                rows={4}
              />
              <span className="create-vault-hint">
                Provide context for future generations about this collection
              </span>
            </div>

            <div className="create-vault-info">
              <div className="create-vault-info-icon">ⓘ</div>
              <div className="create-vault-info-content">
                <p className="create-vault-info-title">
                  You will be the Vault Administrator
                </p>
                <p className="create-vault-info-text">
                  As the creator, you'll have full control over permissions,
                  members, and the ability to designate a successor to ensure
                  your family's archive endures across generations.
                </p>
              </div>
            </div>

            <div className="create-vault-actions">
              <button
                type="submit"
                className="create-vault-button create-vault-button-primary"
              >
                <span className="create-vault-button-text">Create Vault</span>
                <span className="create-vault-button-underline"></span>
              </button>

              <button
                type="button"
                className="create-vault-button create-vault-button-secondary"
                onClick={() => nav("/dashboard")}
              >
                <span className="create-vault-button-text">Cancel</span>
              </button>
            </div>
          </form>

          <div className="create-vault-divider">
            <span className="create-vault-divider-text">or</span>
          </div>

          <div className="create-vault-alternative">
            <p className="create-vault-alternative-text">
              Already have an invitation code?
            </p>
            <button
              className="create-vault-link"
              onClick={() => nav("/join-vault")}
            >
              Join an existing family vault
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
