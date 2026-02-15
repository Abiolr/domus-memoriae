import React from "react";
import { useNavigate } from "react-router-dom";

export default function CreateVault() {
  const nav = useNavigate();

  return (
    <div style={{ padding: 24 }}>
      <h1>CreateVault</h1>
      <p>Userflow: Dashboard → CreateVault → Vault</p>

      <button onClick={() => nav("/vault")}>Create → Vault</button>
      <div style={{ height: 12 }} />
      <button onClick={() => nav("/dashboard")}>Back: Dashboard</button>
    </div>
  );
}
