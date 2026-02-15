import React from "react";
import { useNavigate } from "react-router-dom";

export default function Registration() {
  const nav = useNavigate();

  return (
    <div style={{ padding: 24 }}>
      <h1>Registration</h1>
      <p>Userflow: Homepage → Registration → Onboarding → Dashboard</p>

      <button onClick={() => nav("/onboarding")}>Next: Onboarding</button>
      <div style={{ height: 12 }} />
      <button onClick={() => nav("/")}>Back: Homepage</button>
    </div>
  );
}
