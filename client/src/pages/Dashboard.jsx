import React from "react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const nav = useNavigate();

  return (
    <div style={{ padding: 24 }}>
      <h1>Dashboard</h1>
      <p>Userflow: Dashboard → JoinVault / CreateVault → Vault</p>

      <button onClick={() => nav("/join-vault")}>Join Vault</button>
      <div style={{ height: 12 }} />
      <button onClick={() => nav("/create-vault")}>Create Vault</button>
      <div style={{ height: 24 }} />
      <button onClick={() => nav("/")}>Logout → Homepage</button>
    </div>
  );
}
