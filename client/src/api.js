// src/api.js
// Single source of truth for the backend URL.
// In production, set VITE_API_URL in your Vercel environment variables
// to your Railway backend URL, e.g. https://domus-memoriae-production.up.railway.app
//
// NEVER set VITE_API_URL=http://localhost:5000 in Vercel — that points to
// the user's local machine, not your Railway server.

const API_BASE_URL =
  import.meta.env?.VITE_API_URL || "http://localhost:5000";

export default API_BASE_URL;