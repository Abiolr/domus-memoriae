import React from "react";
import { useNavigate } from "react-router-dom";

export default function JoinVault() {
  const nav = useNavigate();

  return (
    <div style={{ padding: 24 }}>
      <h1>JoinVault</h1>
      <p>Userflow: Dashboard → JoinVault → Vault</p>

      <button onClick={() => nav("/vault")}>Next: Vault</button>
      <div style={{ height: 12 }} />
      <button onClick={() => nav("/dashboard")}>Back: Dashboard</button>
    </div>
  );
}
