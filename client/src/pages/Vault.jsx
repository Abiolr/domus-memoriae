import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/Vault.css";

/* ---- UI Icons ---- */
function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" className="glyph" aria-hidden="true">
      <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h4.2c.6 0 1.2.25 1.6.7l1 1.1c.2.2.45.2.6.2H18A2.5 2.5 0 0 1 20.5 9.5v8A2.5 2.5 0 0 1 18 20H6A2.5 2.5 0 0 1 3.5 17.5z" fill="currentColor" opacity="0.10" />
      <path d="M6 5h4.2c.6 0 1.2.25 1.6.7l1 1.1c.2.2.45.2.6.2H18A2.5 2.5 0 0 1 20.5 9.5v8A2.5 2.5 0 0 1 18 20H6A2.5 2.5 0 0 1 3.5 17.5v-10A2.5 2.5 0 0 1 6 5Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" className="glyph" aria-hidden="true">
      <path d="M7 3.5h6.6c.4 0 .8.15 1.1.44l2.86 2.86c.29.29.44.68.44 1.09V20A2.5 2.5 0 0 1 15.5 22h-8A2.5 2.5 0 0 1 5 19.5v-13A3 3 0 0 1 7 3.5Z" fill="currentColor" opacity="0.10" />
      <path d="M7 3.5h6.6c.4 0 .8.15 1.1.44l2.86 2.86c.29.29.44.68.44 1.09V20A2.5 2.5 0 0 1 15.5 22h-8A2.5 2.5 0 0 1 5 19.5v-13A3 3 0 0 1 7 3.5Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 3.7V7.5A1.5 1.5 0 0 0 15.5 9H19.3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 13h8M8 16h8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function scoreTone(score) {
  if (score >= 85) return "good";
  if (score >= 65) return "mid";
  return "bad";
}

export default function Vault() {
  const nav = useNavigate();
  const { vaultId } = useParams();
  const API_BASE = "http://localhost:5000/api";

  const [viewMode, setViewMode] = useState("grid");
  const [path, setPath] = useState([{ id: "root", name: "Vault" }]);
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [vaultInfo, setVaultInfo] = useState(null);
  const [members, setMembers] = useState([]);
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
      // Persist this vault as the default for the user
      localStorage.setItem("currentVaultId", vaultId);
      fetchVaultDetails();
      fetchFolderContents();
    }
  }, [vaultId, fetchVaultDetails, fetchFolderContents]);

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
      localStorage.removeItem("currentVaultId"); // Clear vault default on logout
      nav("/");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const onOpenFolder = (folder) => {
    setSelectedItem(null);
    setPath((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  const onBackFolder = (idx) => {
    setSelectedItem(null);
    setPath((prev) => prev.slice(0, idx + 1));
  };

  const onClickItem = (item) => {
    if (item.type === "folder") onOpenFolder(item);
    else setSelectedItem(item);
  };

  return (
    <div className="vaultPage">
      <div className="background-grain" />
      <div className="background-vignette" />

      {vaultInfo?.joinCode && (
        <div className="vaultJoinBanner">
          INVITATION CODE: <strong>{vaultInfo.joinCode}</strong>
        </div>
      )}

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
        <div className="resilienceCard">
          <div className={`scorePill ${scoreTone(vaultInfo?.resilienceScore || 0)}`}>
            {vaultInfo?.resilienceScore || 0}<span className="scoreSuffix">/100</span>
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
          <div className={`items ${viewMode}`}>
            {items.map((item) => (
              <button key={item.id} onClick={() => onClickItem(item)}>
                {item.name}
              </button>
            ))}
          </div>
        </section>
        <aside className="vaultDetails">
          <div className="detailsCard">
            <div className="detailsTitle">Members</div>
            {members.map((m, i) => (
              <div key={i}>{m.user_id.slice(-4)} - {m.role}</div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}