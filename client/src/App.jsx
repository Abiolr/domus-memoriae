import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Homepage from "./pages/Homepage.jsx";
import Registration from "./pages/Registration.jsx";
import Onboarding from "./pages/Onboarding.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import JoinVault from "./pages/JoinVault.jsx";
import CreateVault from "./pages/CreateVault.jsx";
import Vault from "./pages/Vault.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Homepage />} />

      <Route path="/register" element={<Registration />} />
      <Route path="/onboarding" element={<Onboarding />} />

      <Route path="/login" element={<Login />} />

      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/join-vault" element={<JoinVault />} />
      <Route path="/create-vault" element={<CreateVault />} />
      <Route path="/vault" element={<Vault />} />

      {/* fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
