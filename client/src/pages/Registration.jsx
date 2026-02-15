import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/Registration.css";

export default function Registration() {
  const nav = useNavigate();
  const [isSettingUpPasskey, setIsSettingUpPasskey] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Set up passkey
    setIsSettingUpPasskey(true);
    
    try {
      // Check if WebAuthn is supported
      if (!window.PublicKeyCredential) {
        alert("Passkeys are not supported on this device. Please use a modern browser.");
        setIsSettingUpPasskey(false);
        return;
      }

      // Create credential options
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const publicKeyCredentialCreationOptions = {
        challenge: challenge,
        rp: {
          name: "Domus Memoriae",
          id: window.location.hostname,
        },
        user: {
          id: new Uint8Array(16),
          name: document.getElementById("email").value,
          displayName: `${document.getElementById("firstName").value} ${document.getElementById("lastName").value}`,
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },  // ES256
          { alg: -257, type: "public-key" } // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          requireResidentKey: false,
          userVerification: "preferred"
        },
        timeout: 60000,
        attestation: "none"
      };

      // Create the credential
      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      });

      console.log("Passkey created successfully:", credential);
      
      // TODO: Send credential to backend for storage
      // In a real implementation, you would send the credential to your backend here
      
      // Navigate to dashboard
      nav("/dashboard");
      
    } catch (error) {
      console.error("Error creating passkey:", error);
      
      if (error.name === "NotAllowedError") {
        alert("Passkey creation was cancelled or not allowed.");
      } else if (error.name === "InvalidStateError") {
        alert("A passkey already exists for this account.");
      } else {
        alert("Failed to create passkey. Please try again.");
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
                  <input 
                    className="form-input" 
                    type="text" 
                    id="suffix" 
                    placeholder="Jr., Sr., III"
                  />
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
                  <input 
                    className="form-input" 
                    type="text" 
                    id="lastName" 
                    placeholder="Family name"
                    required
                  />
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
                <input 
                  className="form-input" 
                  type="date" 
                  id="dateOfBirth" 
                  required
                />
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
                  <input 
                    className="form-input" 
                    type="text" 
                    id="birthCity" 
                    placeholder="City of birth"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="birthState">
                    Province/State
                  </label>
                  <input 
                    className="form-input" 
                    type="text" 
                    id="birthState" 
                    placeholder="Province or state"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="birthCountry">
                  Country
                </label>
                <input 
                  className="form-input" 
                  type="text" 
                  id="birthCountry" 
                  placeholder="Country of birth"
                />
              </div>
            </div>

            {/* Passkey Setup */}
            <div className="form-section">
              <h2 className="section-title">Security</h2>
              
              <div className="passkey-info">
                <p className="passkey-description">
                  Your family archive will be secured with a passkey—a modern, 
                  passwordless authentication method using your device's biometrics 
                  or security key.
                </p>
                <p className="passkey-note">
                  After submitting this form, you'll be prompted to set up your passkey 
                  using Face ID, Touch ID, Windows Hello, or your device's security method.
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

              <button 
                type="button"
                className="back-button" 
                onClick={() => nav("/")}
              >
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
