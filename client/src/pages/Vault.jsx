import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/Vault.css";

export default function Vault() {
  const nav = useNavigate();
  const { vaultId } = useParams();
  const API_BASE = "http://localhost:5000/api";

  const [files, setFiles] = useState([]);
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
        if (data.members) setMembers(data.members);
      }
    } catch (err) {
      console.error("Failed to fetch vault metadata:", err);
    }
  }, [vaultId]);

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/vaults/${vaultId}/files`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) setFiles(data);
    } catch (err) {
      console.error("Failed to fetch files:", err);
    } finally {
      setIsLoading(false);
    }
  }, [vaultId]);

  useEffect(() => {
    if (vaultId) {
      localStorage.setItem("currentVaultId", vaultId);
      fetchVaultDetails();
      fetchFiles();
    }
  }, [vaultId, fetchVaultDetails, fetchFiles]);

  const handleLogout = async () => {
    try {
      localStorage.removeItem("currentVaultId");
      await fetch(`${API_BASE}/auth/logout`, { 
        method: "POST", 
        credentials: "include" 
      });
    } catch (err) {
      console.error("Logout request failed:", err);
    } finally {
      nav("/", { replace: true });
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(`Uploading ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Optional: Add metadata if you have a form for it
      const metadata = {
        title: file.name,
        uploaded_by: "user", // You can enhance this
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
      
      // Refresh file list
      await fetchFiles();
      
      // Clear progress after 2 seconds
      setTimeout(() => {
        setUploadProgress(null);
      }, 2000);
      
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadProgress(`Error: ${err.message}`);
      setTimeout(() => setUploadProgress(null), 3000);
    } finally {
      setIsUploading(false);
      // Reset file input
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

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
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
              <span>All Files ({files.length})</span>
            </div>
            <div className="toolbar-actions">
              <label htmlFor="file-upload" className="upload-btn" style={{
                padding: '8px 16px',
                backgroundColor: '#4a5568',
                color: 'white',
                borderRadius: '4px',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                opacity: isUploading ? 0.6 : 1
              }}>
                {isUploading ? 'Uploading...' : '+ Upload File'}
              </label>
              <input
                id="file-upload"
                type="file"
                onChange={handleFileUpload}
                disabled={isUploading}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {uploadProgress && (
            <div style={{
              padding: '12px',
              margin: '10px 0',
              backgroundColor: uploadProgress.includes('Error') ? '#fee' : '#efe',
              borderRadius: '4px',
              color: uploadProgress.includes('Error') ? '#c00' : '#060'
            }}>
              {uploadProgress}
            </div>
          )}

          {isLoading ? (
            <div style={{ padding: '20px', textAlign: 'center' }}>Loading files...</div>
          ) : files.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
              <p>No files uploaded yet</p>
              <p style={{ fontSize: '14px', marginTop: '10px' }}>Click "Upload File" to add your first memory</p>
            </div>
          ) : (
            <div className="files-list" style={{ padding: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                    <th style={{ padding: '10px' }}>Name</th>
                    <th style={{ padding: '10px' }}>Size</th>
                    <th style={{ padding: '10px' }}>Type</th>
                    <th style={{ padding: '10px' }}>Uploaded</th>
                    <th style={{ padding: '10px' }}>Risk Score</th>
                    <th style={{ padding: '10px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.file_id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px' }}>{file.original_filename}</td>
                      <td style={{ padding: '10px' }}>{formatFileSize(file.size_bytes)}</td>
                      <td style={{ padding: '10px' }}>.{file.ext}</td>
                      <td style={{ padding: '10px' }}>{formatDate(file.uploaded_at)}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          color: file.access_risk_score > 60 ? '#d00' : file.access_risk_score > 30 ? '#f90' : '#0a0'
                        }}>
                          {file.access_risk_score}%
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <button 
                          onClick={() => handleFileDownload(file.file_id, file.original_filename)}
                          style={{
                            padding: '4px 12px',
                            backgroundColor: '#4a5568',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}