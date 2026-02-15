import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);

  const fetchVaultDetails = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/vaults/${vaultId}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setVaultInfo(data);
        if (data.members) {
          // Fetch user details for each member
          const membersWithDetails = await Promise.all(
            data.members.map(async (member) => {
              try {
                const userRes = await fetch(`${API_BASE}/users/${member.user_id}`, { 
                  credentials: "include" 
                });
                if (userRes.ok) {
                  const userData = await userRes.json();
                  return {
                    ...member,
                    first_name: userData.first_name,
                    last_name: userData.last_name
                  };
                }
                return member;
              } catch {
                return member;
              }
            })
          );
          setMembers(membersWithDetails);
        }
      }
    } catch (err) {
      console.error("Failed to fetch vault metadata:", err);
    }
  }, [vaultId]);

  const fetchFolderContents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/vaults/${vaultId}/files`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) setItems(data);
    } catch (err) {
      console.error("Failed to fetch contents:", err);
    } finally {
      setIsLoading(false);
    }
  }, [vaultId]);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(`Uploading ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const metadata = {
        title: file.name,
      };
      formData.append('metadata', JSON.stringify(metadata));

      const res = await fetch(`${API_BASE}/vaults/${vaultId}/files`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setUploadProgress("Upload successful!");
      await fetchFolderContents();
      
      setTimeout(() => {
        setUploadProgress(null);
      }, 2000);
      
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadProgress(`Error: ${err.message}`);
      setTimeout(() => setUploadProgress(null), 3000);
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleFileDownload = async (fileId, filename) => {
    try {
      const res = await fetch(`${API_BASE}/files/${fileId}/download`, {
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Download failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to download file");
    }
  };


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
    <>
      <Header isAuthenticated={true} />
      <div className="vaultPage">
        <div className="background-grain" />
        <div className="background-vignette" />

        {vaultInfo?.joinCode && (
          <div className="vaultJoinBanner">
            <div className="banner-content">
              <span className="banner-label">Share this code to invite family:</span>
              <div className="code-display">
                <span className="code-text">{vaultInfo.joinCode}</span>
                <button 
                  className="copy-button"
                  onClick={() => {
                    navigator.clipboard.writeText(vaultInfo.joinCode);
                    const btn = document.querySelector('.copy-button');
                    const originalText = btn.textContent;
                    btn.textContent = 'Copied!';
                    setTimeout(() => btn.textContent = originalText, 2000);
                  }}
                  title="Copy to clipboard"
                >
                  Copy Code
                </button>
              </div>
            </div>
          </div>
        )}

        <header className="vaultTop">
          <div className="vaultTitleRow">
            <div className="vault-header-content">
              <div className="header-ornament"></div>
              <h1 className="vaultTitle">{vaultInfo?.name || "Vault"}</h1>
              <p className="vaultSubtitle">FAMILY ARCHIVE</p>
            </div>
          </div>
          <div className="resilienceCard">
            <div className="resilienceLeft">
              <div className="labelRow">
                <span className="label">Archive Resilience</span>
              </div>
            </div>
            <div className={`scorePill ${scoreTone(vaultInfo?.resilienceScore || 0)}`}>
              {vaultInfo?.resilienceScore || 0}<span className="scoreSuffix">/100</span>
            </div>
          </div>
        </header>

        <main className="vaultMain">
          <section className="vaultBrowser">
            <div className="toolbar">
              <div className="toolbar-left">
                <h2 className="browser-title">Archive Files</h2>
              </div>
              <div className="toolbar-right">
                <label htmlFor="file-upload" className="upload-button">
                  <span className="button-text">Upload Files</span>
                  <span className="button-underline"></span>
                  <input
                    id="file-upload"
                    type="file"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    style={{ display: 'none' }}
                    multiple
                  />
                </label>
              </div>
            </div>

            {uploadProgress && (
              <div className={`upload-status ${uploadProgress.includes('Error') ? 'error' : 'success'}`}>
                {uploadProgress}
              </div>
            )}
            
            <div className={`items ${viewMode}`}>
              {isLoading ? (
                <div className="emptyState">Loading...</div>
              ) : items.length === 0 ? (
                <div className="emptyState">
                  <div className="emptyBig">No files yet</div>
                  <div className="emptySmall">Upload files to begin building your archive</div>
                </div>
              ) : (
                items.map((item) => (
                  <div 
                    key={item._id || item.file_id} 
                    className={`itemCard ${selectedItem?._id === item._id ? 'selected' : ''}`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="icon">
                      <FileIcon />
                    </div>
                    <div className="meta">
                      <div className="nameRow">
                        <span className="name">{item.original_filename}</span>
                        {item.access_risk_score && (
                          <span className={`miniScore ${scoreTone(100 - item.access_risk_score)}`}>
                            {100 - item.access_risk_score}
                          </span>
                        )}
                      </div>
                      {item.size_bytes && (
                        <div className="sub">
                          {(item.size_bytes / 1024).toFixed(1)} KB
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
          
          <aside className="vaultDetails">
            <div className="detailsCard">
              <div className="detailsTitle">Members</div>
              {members.length === 0 ? (
                <div className="emptyState">No members</div>
              ) : (
                members.map((m, i) => (
                  <div key={i} className="memberItem">
                    <span className="memberName">
                      {m.first_name && m.last_name 
                        ? `${m.first_name} ${m.last_name}`
                        : `User ${m.user_id.slice(-4)}`
                      }
                    </span>
                    <span className="memberRole">{m.role}</span>
                  </div>
                ))
              )}
            </div>
            
            {selectedItem && (
              <div className="detailsCard">
                <div className="detailsHeader">
                  <div className="detailsName">{selectedItem.original_filename}</div>
                  {selectedItem.access_risk_score && (
                    <div className={`miniScore ${scoreTone(100 - selectedItem.access_risk_score)}`}>
                      {100 - selectedItem.access_risk_score}
                    </div>
                  )}
                </div>
                <div className="kv">
                  <div className="k">Type</div>
                  <div className="v">.{selectedItem.ext}</div>
                  {selectedItem.size_bytes && (
                    <>
                      <div className="k">Size</div>
                      <div className="v">{(selectedItem.size_bytes / 1024).toFixed(1)} KB</div>
                    </>
                  )}
                  {selectedItem.uploaded_at && (
                    <>
                      <div className="k">Uploaded</div>
                      <div className="v">{new Date(selectedItem.uploaded_at).toLocaleDateString()}</div>
                    </>
                  )}
                </div>
                <button 
                  className="download-button"
                  onClick={() => handleFileDownload(selectedItem.file_id, selectedItem.original_filename)}
                >
                  <span className="button-text">Download File</span>
                  <span className="button-underline"></span>
                </button>
              </div>
            )}
          </aside>
        </main>
      </div>
      <Footer />
    </>
  );
}
