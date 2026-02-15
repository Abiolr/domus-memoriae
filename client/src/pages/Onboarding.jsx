import React from "react";
import { useNavigate } from "react-router-dom";

export default function Onboarding() {
  const nav = useNavigate();

  return (
    <div style={{ padding: 24 }}>
      <h1>Onboarding</h1>
      <p>Userflow: Registration → Onboarding → Dashboard</p>

      <button onClick={() => nav("/dashboard")}>Finish: Dashboard</button>
      <div style={{ height: 12 }} />
      <button onClick={() => nav("/register")}>Back: Registration</button>
    </div>
  );
}
