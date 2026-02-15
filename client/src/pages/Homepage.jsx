import React from "react";
import { useNavigate } from "react-router-dom";

export default function Homepage() {
  const nav = useNavigate();

  return (
    <div style={{ padding: 24 }}>
      <h1>Homepage</h1>
      <p>Start here.</p>

      <button onClick={() => nav("/register")}>Go to Registration</button>
      <div style={{ height: 12 }} />
      <button onClick={() => nav("/login")}>Go to Login</button>
    </div>
  );
}
