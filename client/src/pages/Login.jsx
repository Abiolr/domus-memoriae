import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Login.css";

export default function Login() {
  const nav = useNavigate();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setIsAuthenticating(true);
    
    try {
      // Check if WebAuthn is supported
      if (!window.PublicKeyCredential) {
        alert("Passkeys are not supported on this device. Please use a modern browser.");
        setIsAuthenticating(false);
        return;
      }

      // Create authentication options
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const publicKeyCredentialRequestOptions = {
        challenge: challenge,
        timeout: 60000,
        rpId: window.location.hostname,
        userVerification: "preferred"
      };

      // Request the credential
      const credential = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions
      });

      console.log("Authentication successful:", credential);
      
      // TODO: Send credential to backend for verification
      // In a real implementation, you would verify the credential with your backend here
      
      // Navigate to dashboard
      nav("/dashboard");
      
    } catch (error) {
      console.error("Error authenticating with passkey:", error);
      
      if (error.name === "NotAllowedError") {
        alert("Authentication was cancelled or not allowed.");
      } else if (error.name === "InvalidStateError") {
        alert("No passkey found for this account.");
      } else {
        alert("Failed to authenticate. Please try again.");
      }
      
      setIsAuthenticating(false);
    }
  };

  return (
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
            <span>Return to Homepage</span>
          </button>
        </div>
      </div>
    </div>
  );
}
