import React, { useState, useEffect } from "react";
import API_BASE_URL from "../api";
import { useNavigate } from "react-router-dom";
import "../styles/Dashboard.css";

export default function Dashboard() {
  const nav = useNavigate();
  const API_BASE = `${API_BASE_URL}/api`;

  const [vaults, setVaults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchVaults();
    validateCurrentVault();
  }, []);

  const validateCurrentVault = async () => {
    const savedVaultId = localStorage.getItem("currentVaultId");
    if (savedVaultId) {
      try {
        const res = await fetch(`${API_BASE}/vaults/${savedVaultId}`, {
          credentials: "include"
        });
        if (!res.ok) {
          localStorage.removeItem("currentVaultId");
        }
      } catch (err) {
        localStorage.removeItem("currentVaultId");
      }
    }
  };

  const fetchVaults = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/vaults`, {
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) {
          nav("/login", { replace: true });
          return;
        }
        throw new Error("Failed to fetch vaults");
      }

      const data = await res.json();
      setVaults(data);
    } catch (err) {
      console.error("Failed to fetch vaults:", err);
      setError("Failed to load vaults. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVaultClick = (vaultId) => {
    localStorage.setItem("currentVaultId", vaultId);
    nav(`/vault/${vaultId}`);
  };

  const handleCreateVault = () => {
    nav("/create-vault");
  };

  const handleJoinVault = () => {
    nav("/join-vault");
  };

  const handleLogout = async () => {
    try {
      localStorage.clear();
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      nav("/", { replace: true });
    }
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "Unknown date";
    }
  };

  const getRoleBadge = (vault) => {
    const currentUserId = localStorage.getItem("user_id");
    const member = vault.members?.find((m) => String(m.user_id) === String(currentUserId));
    const role = member?.role || "viewer";
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <div className="dashboard">
      <div className="background-grain"></div>
      <div className="background-vignette"></div>

      <div className="dashboard-container">
        <button className="dashboard-back" onClick={handleLogout}>
          ← Logout
        </button>

        <div className="dashboard-card">
          <div className="dashboard-header">
            <div className="header-ornament"></div>
            <h1 className="dashboard-title">Family Vaults</h1>
            <p className="dashboard-subtitle">Your Digital Legacy Archives</p>
          </div>

          {/* Action Buttons */}
          <div className="dashboard-actions">
            <button className="action-button" onClick={handleCreateVault}>
              <span className="button-text">Create New Vault</span>
              <span className="button-underline"></span>
            </button>
            <button className="action-button action-button-secondary" onClick={handleJoinVault}>
              <span className="button-text">Join Existing Vault</span>
              <span className="button-underline"></span>
            </button>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="dashboard-loading">
              <div className="loading-ornament"></div>
              <p>Retrieving your vaults...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="dashboard-error">
              <p>{error}</p>
              <button className="retry-button" onClick={fetchVaults}>
                Try Again
              </button>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && vaults.length === 0 && (
            <div className="dashboard-empty">
              <div className="empty-ornament"></div>
              <h2 className="empty-title">No Vaults Yet</h2>
              <p className="empty-text">
                Begin your journey by creating a new family vault to preserve cherished memories, 
                or join an existing vault using an invitation code shared with you.
              </p>
            </div>
          )}

          {/* Vaults List */}
          {!isLoading && !error && vaults.length > 0 && (
            <>
              <div className="vaults-divider"></div>
              <div className="vaults-list">
                {vaults.map((vault, index) => (
                  <div
                    key={vault._id || vault.id}
                    className="vault-item"
                    onClick={() => handleVaultClick(vault._id || vault.id)}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="vault-item-header">
                      <h3 className="vault-item-title">{vault.name}</h3>
                      <span className="vault-item-role">{getRoleBadge(vault)}</span>
                    </div>

                    {vault.description && (
                      <p className="vault-item-description">{vault.description}</p>
                    )}

                    <div className="vault-item-details">
                      <div className="detail-row">
                        <span className="detail-label">Members</span>
                        <span className="detail-value">{vault.members?.length || 0}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Established</span>
                        <span className="detail-value">{formatDate(vault.created_at)}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Invitation Code</span>
                        <span className="detail-value detail-code">{vault.join_code}</span>
                      </div>
                    </div>

                    <div className="vault-item-footer">
                      <span className="vault-enter-text">Enter Vault</span>
                      <span className="vault-enter-arrow">→</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="dashboard-note">
                <div className="note-ornament"></div>
                <p>
                  You may belong to multiple vaults — your birth family, your spouse's lineage, 
                  or one you establish for your own descendants. Each preserves its unique heritage.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}