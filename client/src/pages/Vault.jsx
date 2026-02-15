import React from "react";
import { useNavigate } from "react-router-dom";

export default function Vault() {
  const nav = useNavigate();

  return (
    <div style={{ padding: 24 }}>
      <h1>Vault</h1>
      <p>End of flow for now.</p>

      <button onClick={() => nav("/dashboard")}>Back: Dashboard</button>
      <div style={{ height: 12 }} />
      <button onClick={() => nav("/")}>Home</button>
    </div>
  );
}
