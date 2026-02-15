import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/Login.css";

// Works for Vite (import.meta.env) and CRA (process.env)
const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  (typeof process !== "undefined" && process.env?.REACT_APP_API_URL) ||
  "http://localhost:5000";

// --- WebAuthn helpers ---
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

const serializeAssertion = (cred) => {
  if (!cred) return null;
  return {
    id: cred.id,
    type: cred.type,
    rawId: bufferToBase64url(cred.rawId),
    response: {
      clientDataJSON: bufferToBase64url(cred.response.clientDataJSON),
      authenticatorData: bufferToBase64url(cred.response.authenticatorData),
      signature: bufferToBase64url(cred.response.signature),
      userHandle: cred.response.userHandle ? bufferToBase64url(cred.response.userHandle) : null,
    },
    clientExtensionResults: cred.getClientExtensionResults?.() || {},
  };
};

export default function Login() {
  const nav = useNavigate();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    setIsAuthenticating(true);

    try {
      // Check if WebAuthn is supported
      if (!window.PublicKeyCredential) {
        alert("Passkeys are not supported on this device. Please use a modern browser.");
        setIsAuthenticating(false);
        return;
      }

      const email = document.getElementById("email").value;

      // 1) Ask backend for a WebAuthn login challenge + options
      const beginRes = await fetch(`${API_BASE_URL}/api/auth/login/begin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });

      const beginJson = await beginRes.json().catch(() => ({}));
      if (!beginRes.ok) {
        throw new Error(beginJson?.error || "Login begin failed");
      }

      const publicKeyCredentialRequestOptions = {
        challenge: base64urlToUint8Array(beginJson.challenge),
        timeout: beginJson.timeout,
        rpId: beginJson.rpId,
        userVerification: beginJson.userVerification,
        allowCredentials: Array.isArray(beginJson.allowCredentials)
          ? beginJson.allowCredentials.map((c) => ({
              ...c,
              id: c.id ? base64urlToUint8Array(c.id) : undefined,
            }))
          : [],
      };

      // Request the credential
      const credential = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      });

      console.log("Authentication successful:", credential);

      // 2) Send assertion back to backend
      const completeRes = await fetch(`${API_BASE_URL}/api/auth/login/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          challenge: beginJson.challenge,
          credential: serializeAssertion(credential),
        }),
      });

      const completeJson = await completeRes.json().catch(() => ({}));
      if (!completeRes.ok) {
        throw new Error(completeJson?.error || "Login complete failed");
      }

      // Navigate to dashboard
      nav("/dashboard");
    } catch (error) {
      console.error("Error authenticating with passkey:", error);

      const msg = error?.message || "Failed to authenticate. Please try again.";
      setError(msg);

      if (error.name === "NotAllowedError") {
        alert("Authentication was cancelled or not allowed.");
      } else if (error.name === "InvalidStateError") {
        alert("No passkey found for this account.");
      } else {
        alert(msg);
      }

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
            {error ? (
              <div className="form-error" role="alert" style={{ marginBottom: "12px" }}>
                {error}
              </div>
            ) : null}

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email
              </label>
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

          <button className="back-button" onClick={() => nav("/")}>
            <span className="back-arrow">←</span>
            <span>Return to Homepage</span>
          </button>
        </div>
      </div>
    </div>
      <Footer />
    </>
  );
}
