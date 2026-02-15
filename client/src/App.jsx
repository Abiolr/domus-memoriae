import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Homepage from "./pages/Homepage.jsx";
import Registration from "./pages/Registration.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import JoinVault from "./pages/JoinVault.jsx";
import CreateVault from "./pages/CreateVault.jsx";
import Vault from "./pages/Vault.jsx";

// Helper component to handle conditional home routing
const RootRedirect = () => {
  const currentVaultId = localStorage.getItem("currentVaultId");
  if (currentVaultId) {
    return <Navigate to={`/vault/${currentVaultId}`} replace />;
  }
  return <Homepage />;
};

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/register" element={<Registration />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/join-vault" element={<JoinVault />} />
      <Route path="/create-vault" element={<CreateVault />} />
      <Route path="/vault/:vaultId" element={<Vault />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}