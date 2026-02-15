import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/Vault.css";

export default function Vault() {
  const nav = useNavigate();
  const { vaultId } = useParams();
  const API_BASE = "http://localhost:5000/api";

  const [items, setItems] = useState([]);
  const [vaultInfo, setVaultInfo] = useState(null);
  const [members, setMembers] = useState([]);
  const [path, setPath] = useState([{ id: "root", name: "Vault" }]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchVaultDetails = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/vaults/${vaultId}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setVaultInfo(data);
        if (data.members) setMembers(data.members);
      }
    } catch (err) {
      console.error("Failed to fetch vault metadata:", err);
    }
  }, [vaultId]);

  const fetchFolderContents = useCallback(async () => {
    setIsLoading(true);
    const currentFolder = path[path.length - 1];
    const folderId = currentFolder.id === "root" ? "root" : currentFolder.id;
    try {
      const res = await fetch(`${API_BASE}/vaults/${vaultId}/items?folder_id=${folderId}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) setItems(data);
    } catch (err) {
      console.error("Failed to fetch contents:", err);
    } finally {
      setIsLoading(false);
    }
  }, [vaultId, path]);

  useEffect(() => {
    if (vaultId) {
      localStorage.setItem("currentVaultId", vaultId);
      fetchVaultDetails();
      fetchFolderContents();
    }
  }, [vaultId, fetchVaultDetails, fetchFolderContents]);

  const handleLogout = async () => {
    try {
      // 1. Clear local storage first so the UI redirect logic catches it
      localStorage.removeItem("currentVaultId");
      
      // 2. Inform the backend to clear the session cookie
      await fetch(`${API_BASE}/auth/logout`, { 
        method: "POST", 
        credentials: "include" 
      });
    } catch (err) {
      console.error("Logout request failed:", err);
    } finally {
      // 3. Always redirect to home regardless of server response
      nav("/", { replace: true });
    }
  };

  const onBackFolder = (idx) => {
    setPath((prev) => prev.slice(0, idx + 1));
  };

  return (
    <div className="vaultPage">
      <div className="background-grain" />
      <div className="background-vignette" />

      <header className="vaultTop">
        <div className="vaultTitleRow">
          <div>
            <h1 className="vaultTitle">{vaultInfo?.name || "Vault"}</h1>
            <p className="vaultSubtitle">FAMILY ARCHIVE</p>
          </div>
          <div className="vaultNavBtns">
            <button className="ghostBtn" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </header>

      <main className="vaultMain">
        <section className="vaultBrowser">
          <div className="toolbar">
            <div className="breadcrumbs">
              {path.map((crumb, idx) => (
                <button key={crumb.id} onClick={() => onBackFolder(idx)}>
                  {crumb.name}
                </button>
              ))}
            </div>
          </div>
          <div className="items grid">
            {items.map((item) => (
              <button key={item.id} className="item-btn">
                {item.name}
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}