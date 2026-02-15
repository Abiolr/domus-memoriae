import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/Login.css";

const API_BASE_URL = "http://localhost:5000";

const base64urlToUint8Array = (base64url) => {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
};

const bufferToBase64url = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const serializeAssertion = (cred) => ({
  id: cred.id,
  type: cred.type,
  rawId: bufferToBase64url(cred.rawId),
  response: {
    clientDataJSON: bufferToBase64url(cred.response.clientDataJSON),
    authenticatorData: bufferToBase64url(cred.response.authenticatorData),
    signature: bufferToBase64url(cred.response.signature),
    userHandle: cred.response.userHandle ? bufferToBase64url(cred.response.userHandle) : null,
  }
});

export default function Login() {
  const nav = useNavigate();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsAuthenticating(true);

    try {
      const email = document.getElementById("email").value;

      // 1. Begin Login
      const beginRes = await fetch(`${API_BASE_URL}/api/auth/login/begin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const beginJson = await beginRes.json();
      if (!beginRes.ok) throw new Error(beginJson.error);

      // 2. FIXED: Map allowCredentials safely
      const allowCredentials = (beginJson.allowCredentials || []).map(c => ({
        ...c,
        id: base64urlToUint8Array(c.id)
      }));

      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: base64urlToUint8Array(beginJson.challenge),
          allowCredentials,
          rpId: beginJson.rpId,
          userVerification: "preferred"
        }
      });

      // 3. Complete Login
      const completeRes = await fetch(`${API_BASE_URL}/api/auth/login/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ challenge: beginJson.challenge, credential: serializeAssertion(credential) }),
      });
      if (!completeRes.ok) throw new Error("Verification failed");

      // 4. Fetch user's vaults
      const vaultRes = await fetch(`${API_BASE_URL}/api/vaults`, { credentials: "include" });
      const vaults = await vaultRes.json();

      // 5. Navigate based on vault membership
      if (Array.isArray(vaults) && vaults.length > 0) {
        // Get the vault ID properly (it's in _id field due to MongoDB)
        const vaultId = vaults[0]._id || vaults[0].id;
        
        if (vaultId) {
          localStorage.setItem("currentVaultId", vaultId);
          console.log('[DEBUG] Navigating to vault:', vaultId);
          nav(`/vault/${vaultId}`);
        } else {
          console.error('[ERROR] Vault ID not found in vault object:', vaults[0]);
          nav("/dashboard");
        }
      } else {
        // No vaults - go to dashboard
        localStorage.removeItem("currentVaultId");
        nav("/dashboard");
      }
    } catch (err) {
      console.error('[ERROR] Login failed:', err);
      setError(err.message);
      setIsAuthenticating(false);
    }
  };

  return (
    <>
      <Header isAuthenticated={false} />
      <div className="login">
        <div className="background-grain"></div>
        <div className="background-vignette"></div>
        
        <div className="login-container">
          <div className="login-card">
            <header className="login-header">
              <div className="header-ornament"></div>
              <h1 className="login-title">Domus Memoriae</h1>
              <p className="login-subtitle">Enter the Archive</p>
            </header>

            <form className="login-form" onSubmit={handleSubmit}>
              {error && <div className="form-error">{error}</div>}
              
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email</label>
                <input 
                  className="form-input" 
                  type="email" 
                  id="email" 
                  placeholder="your.email@example.com"
                  required
                  disabled={isAuthenticating}
                />
              </div>

              <button type="submit" className="login-button" disabled={isAuthenticating}>
                <span className="button-text">
                  {isAuthenticating ? "Authenticating..." : "Authenticate with Passkey"}
                </span>
                <span className="button-underline"></span>
              </button>
            </form>

            <div className="login-divider">
              <span className="divider-text">or</span>
            </div>

            <button 
              className="back-button" 
              onClick={() => nav("/")}
            >
              <span className="back-arrow">←</span>
              <span>Return to homepage</span>
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
