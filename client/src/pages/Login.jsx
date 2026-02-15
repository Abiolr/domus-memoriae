import React from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const nav = useNavigate();

  return (
    <div style={{ padding: 24 }}>
      <h1>Login</h1>
      <p>Userflow: Homepage → Login → Dashboard</p>

      <button onClick={() => nav("/dashboard")}>Login → Dashboard</button>
      <div style={{ height: 12 }} />
      <button onClick={() => nav("/")}>Back: Homepage</button>
    </div>
  );
}
