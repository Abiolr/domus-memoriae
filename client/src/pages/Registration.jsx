import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/Registration.css";

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

const serializeAttestation = (cred) => {
  if (!cred) return null;
  return {
    id: cred.id,
    type: cred.type,
    rawId: bufferToBase64url(cred.rawId),
    response: {
      clientDataJSON: bufferToBase64url(cred.response.clientDataJSON),
      attestationObject: bufferToBase64url(cred.response.attestationObject),
    },
    clientExtensionResults: cred.getClientExtensionResults?.() || {},
  };
};

export default function Registration() {
  const nav = useNavigate();
  const [isSettingUpPasskey, setIsSettingUpPasskey] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Set up passkey
    setIsSettingUpPasskey(true);

    try {
      // Check if WebAuthn is supported
      if (!window.PublicKeyCredential) {
        alert("Passkeys are not supported on this device. Please use a modern browser.");
        setIsSettingUpPasskey(false);
        return;
      }

      // Collect form data
      const formData = {
        email: document.getElementById("email").value,
        phone: document.getElementById("phone").value,
        firstName: document.getElementById("firstName").value,
        middleNames: document.getElementById("middleNames").value,
        suffix: document.getElementById("suffix").value,
        maidenName: document.getElementById("maidenName").value,
        lastName: document.getElementById("lastName").value,
        preferredName: document.getElementById("preferredName").value,
        dateOfBirth: document.getElementById("dateOfBirth").value,
        birthCity: document.getElementById("birthCity").value,
        birthState: document.getElementById("birthState").value,
        birthCountry: document.getElementById("birthCountry").value,
      };

      // 1) Ask backend for a WebAuthn challenge + options
      const beginRes = await fetch(`${API_BASE_URL}/api/auth/register/begin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      const beginJson = await beginRes.json().catch(() => ({}));
      if (!beginRes.ok) {
        throw new Error(beginJson?.error || "Registration begin failed");
      }

      const publicKeyCredentialCreationOptions = {
        challenge: base64urlToUint8Array(beginJson.challenge),
        rp: beginJson.rp,
        user: {
          ...beginJson.user,
          id: base64urlToUint8Array(beginJson.user.id),
        },
        pubKeyCredParams: beginJson.pubKeyCredParams,
        authenticatorSelection: beginJson.authenticatorSelection,
        timeout: beginJson.timeout,
        attestation: beginJson.attestation,
      };

      // Create the credential
      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      });

      console.log("Passkey created successfully:", credential);

      // 2) Send created credential back to backend
      const completeRes = await fetch(`${API_BASE_URL}/api/auth/register/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          challenge: beginJson.challenge,
          credential: serializeAttestation(credential),
        }),
      });

      const completeJson = await completeRes.json().catch(() => ({}));
      if (!completeRes.ok) {
        throw new Error(completeJson?.error || "Registration complete failed");
      }

      // Navigate to dashboard
      nav("/dashboard");
    } catch (error) {
      console.error("Error creating passkey:", error);

      const msg = error?.message || "Failed to create passkey. Please try again.";
      setError(msg);

      if (error.name === "NotAllowedError") {
        alert("Passkey creation was cancelled or not allowed.");
      } else if (error.name === "InvalidStateError") {
        alert("A passkey already exists for this account.");
      } else {
        alert(msg);
      }

      setIsSettingUpPasskey(false);
    }
  };

  return (
    <>
      <Header isAuthenticated={false} />
      <div className="registration">
      <div className="background-grain"></div>
      <div className="background-vignette"></div>

      <div className="registration-container">
        <div className="registration-card">
          <header className="registration-header">
            <div className="header-ornament"></div>
            <h1 className="registration-title">Domus Memoriae</h1>
            <p className="registration-subtitle">Begin Your Legacy</p>
          </header>

          <form className="registration-form" onSubmit={handleSubmit}>
            {error ? (
              <div className="form-error" role="alert" style={{ marginBottom: "12px" }}>
                {error}
              </div>
            ) : null}

            {/* Contact Information */}
            <div className="form-section">
              <h2 className="section-title">Contact</h2>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="email">
                    Email <span className="required">*</span>
                  </label>
                  <input
                    className="form-input"
                    type="email"
                    id="email"
                    placeholder="your.email@example.com"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="phone">
                    Phone Number <span className="required">*</span>
                  </label>
                  <input
                    className="form-input"
                    type="tel"
                    id="phone"
                    placeholder="+1 (555) 000-0000"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div className="form-section">
              <h2 className="section-title">Identity</h2>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="firstName">
                    First Name <span className="required">*</span>
                  </label>
                  <input
                    className="form-input"
                    type="text"
                    id="firstName"
                    placeholder="Given name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="middleNames">
                    Legal Middle Names
                  </label>
                  <input
                    className="form-input"
                    type="text"
                    id="middleNames"
                    placeholder="Middle name(s)"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group form-group-small">
                  <label className="form-label" htmlFor="suffix">
                    Suffix
                  </label>
                  <input className="form-input" type="text" id="suffix" placeholder="Jr., Sr., III" />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="maidenName">
                    Maiden/Birth Name
                  </label>
                  <input
                    className="form-input"
                    type="text"
                    id="maidenName"
                    placeholder="Birth surname"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="lastName">
                    Last Name <span className="required">*</span>
                  </label>
                  <input className="form-input" type="text" id="lastName" placeholder="Family name" required />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="preferredName">
                    Preferred Name
                  </label>
                  <input
                    className="form-input"
                    type="text"
                    id="preferredName"
                    placeholder="How you wish to be known"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="dateOfBirth">
                  Date of Birth <span className="required">*</span>
                </label>
                <input className="form-input" type="date" id="dateOfBirth" required />
              </div>
            </div>

            {/* Place of Birth */}
            <div className="form-section">
              <h2 className="section-title">Place of Origin</h2>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="birthCity">
                    City
                  </label>
                  <input className="form-input" type="text" id="birthCity" placeholder="City of birth" />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="birthState">
                    Province/State
                  </label>
                  <input className="form-input" type="text" id="birthState" placeholder="Province or state" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="birthCountry">
                  Country
                </label>
                <input className="form-input" type="text" id="birthCountry" placeholder="Country of birth" />
              </div>
            </div>

            {/* Passkey Setup */}
            <div className="form-section">
              <h2 className="section-title">Security</h2>

              <div className="passkey-info">
                <p className="passkey-description">
                  Your family archive will be secured with a passkey—a modern, passwordless authentication method using
                  your device's biometrics or security key.
                </p>
                <p className="passkey-note">
                  After submitting this form, you'll be prompted to set up your passkey using Face ID, Touch ID,
                  Windows Hello, or your device's security method.
                </p>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="submit-button" disabled={isSettingUpPasskey}>
                <span className="button-text">
                  {isSettingUpPasskey ? "Setting up passkey..." : "Create Account & Set Up Passkey"}
                </span>
                <span className="button-underline"></span>
              </button>

              <button type="button" className="back-button" onClick={() => nav("/")}>
                <span className="back-arrow">←</span>
                <span>Return to Homepage</span>
              </button>
            </div>

            <p className="required-note">
              <span className="required">*</span> Required fields
            </p>
          </form>
        </div>
      </div>
    </div>
      <Footer />
    </>
  );
}
