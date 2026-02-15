import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Homepage from "./pages/Homepage.jsx";
import Registration from "./pages/Registration.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import JoinVault from "./pages/JoinVault.jsx";
import CreateVault from "./pages/CreateVault.jsx";
import Vault from "./pages/Vault.jsx";

export default function App() {
  // Check if a vault ID is saved to make it the default landing page
  const currentVaultId = localStorage.getItem("currentVaultId");

  return (
    <Routes>
      {/* Root path: Redirect to vault if session exists, otherwise show homepage */}
      <Route 
        path="/" 
        element={currentVaultId ? <Navigate to={`/vault/${currentVaultId}`} replace /> : <Homepage />} 
      />

      <Route path="/register" element={<Registration />} />
      <Route path="/login" element={<Login />} />
      
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/join-vault" element={<JoinVault />} />
      <Route path="/create-vault" element={<CreateVault />} />
      
      {/* Dynamic route for the family archive */}
      <Route path="/vault/:vaultId" element={<Vault />} />

      {/* Fallback to root logic */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}