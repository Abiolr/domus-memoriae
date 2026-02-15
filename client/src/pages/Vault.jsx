import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Vault.css";

/**
 * Placeholder vault data (no backend yet).
 */
const VAULT_PLACEHOLDER = {
  root: {
    id: "root",
    type: "folder",
    name: "Vault",
    children: [
      {
        id: "fld-photos",
        type: "folder",
        name: "Photos",
        children: [
          {
            id: "f-001",
            type: "file",
            name: "grandma_1978.jpg",
            format: "JPG",
            sizeMb: 3.4,
            lastModified: "2025-12-21",
            tags: ["family", "old", "scanned"],
            survivabilityScore: 68,
          },
          {
            id: "f-002",
            type: "file",
            name: "wedding_2002.tiff",
            format: "TIFF",
            sizeMb: 54.2,
            lastModified: "2026-01-07",
            tags: ["wedding", "high-quality"],
            survivabilityScore: 91,
          },
        ],
      },
      {
        id: "fld-docs",
        type: "folder",
        name: "Documents",
        children: [
          {
            id: "f-003",
            type: "file",
            name: "will_2014.pdf",
            format: "PDF",
            sizeMb: 1.1,
            lastModified: "2024-02-12",
            tags: ["legal", "important"],
            survivabilityScore: 88,
          },
          {
            id: "f-004",
            type: "file",
            name: "family_tree.json",
            format: "JSON",
            sizeMb: 0.2,
            lastModified: "2026-02-01",
            tags: ["genealogy"],
            survivabilityScore: 79,
          },
        ],
      },
      {
        id: "fld-videos",
        type: "folder",
        name: "Videos",
        children: [
          {
            id: "f-005",
            type: "file",
            name: "dad_story_1996.mov",
            format: "MOV",
            sizeMb: 820,
            lastModified: "2023-08-19",
            tags: ["oral-history"],
            survivabilityScore: 52,
          },
          {
            id: "f-006",
            type: "file",
            name: "family_reunion_2011.mp4",
            format: "MP4",
            sizeMb: 410,
            lastModified: "2022-06-30",
            tags: ["reunion"],
            survivabilityScore: 74,
          },
        ],
      },
      {
        id: "f-007",
        type: "file",
        name: "README_archive_rules.txt",
        format: "TXT",
        sizeMb: 0.01,
        lastModified: "2026-02-10",
        tags: ["documentation"],
        survivabilityScore: 95,
      },
    ],
  },
};

function getFolderByPath(rootFolder, pathIds) {
  let current = rootFolder;
  for (let i = 1; i < pathIds.length; i++) {
    const nextId = pathIds[i];
    const next = (current.children || []).find(
      (c) => c.id === nextId && c.type === "folder"
    );
    if (!next) return current;
    current = next;
  }
  return current;
}

function scoreTone(score) {
  if (score >= 85) return "good";
  if (score >= 65) return "mid";
  return "bad";
}

function collectFileScores(node) {
  const scores = [];
  const stack = [node];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur) continue;

    if (cur.type === "file" && typeof cur.survivabilityScore === "number") {
      scores.push(cur.survivabilityScore);
    }
    if (cur.type === "folder" && Array.isArray(cur.children)) {
      for (const child of cur.children) stack.push(child);
    }
  }
  return scores;
}

function avg(nums) {
  if (!nums.length) return 0;
  const s = nums.reduce((a, b) => a + b, 0);
  return Math.round(s / nums.length);
}

/* ---- Favicon-style icons (inline SVG) ---- */

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" className="glyph" aria-hidden="true">
      <path
        d="M3.5 7.5A2.5 2.5 0 0 1 6 5h4.2c.6 0 1.2.25 1.6.7l1 1.1c.2.2.45.2.6.2H18A2.5 2.5 0 0 1 20.5 9.5v8A2.5 2.5 0 0 1 18 20H6A2.5 2.5 0 0 1 3.5 17.5z"
        fill="currentColor"
        opacity="0.10"
      />
      <path
        d="M6 5h4.2c.6 0 1.2.25 1.6.7l1 1.1c.2.2.45.2.6.2H18A2.5 2.5 0 0 1 20.5 9.5v8A2.5 2.5 0 0 1 18 20H6A2.5 2.5 0 0 1 3.5 17.5v-10A2.5 2.5 0 0 1 6 5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" className="glyph" aria-hidden="true">
      <path
        d="M7 3.5h6.6c.4 0 .8.15 1.1.44l2.86 2.86c.29.29.44.68.44 1.09V20A2.5 2.5 0 0 1 15.5 22h-8A2.5 2.5 0 0 1 5 19.5v-13A3 3 0 0 1 7 3.5Z"
        fill="currentColor"
        opacity="0.10"
      />
      <path
        d="M7 3.5h6.6c.4 0 .8.15 1.1.44l2.86 2.86c.29.29.44.68.44 1.09V20A2.5 2.5 0 0 1 15.5 22h-8A2.5 2.5 0 0 1 5 19.5v-13A3 3 0 0 1 7 3.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M14 3.7V7.5A1.5 1.5 0 0 0 15.5 9H19.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8 13h8M8 16h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Vault() {
  const nav = useNavigate();

  const [viewMode, setViewMode] = useState("grid"); // "grid" | "list"
  const [path, setPath] = useState(["root"]);
  const [selectedFileId, setSelectedFileId] = useState(null);

  const root = VAULT_PLACEHOLDER.root;

  const resilienceScore = useMemo(() => {
    const scores = collectFileScores(root);
    return avg(scores);
  }, [root]);

  const currentFolder = useMemo(() => getFolderByPath(root, path), [root, path]);

  const items = useMemo(() => {
    const children = currentFolder.children || [];
    return [...children].sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [currentFolder]);

  const selectedFile = useMemo(() => {
    if (!selectedFileId) return null;

    const stack = [root];
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;

      if (node.type === "file" && node.id === selectedFileId) return node;

      if (node.type === "folder" && node.children) {
        for (const child of node.children) stack.push(child);
      }
    }
    return null;
  }, [selectedFileId, root]);

  const breadcrumb = useMemo(() => {
    const names = [];
    let current = root;
    names.push({ id: "root", name: current.name });
    for (let i = 1; i < path.length; i++) {
      const id = path[i];
      const next = (current.children || []).find(
        (c) => c.id === id && c.type === "folder"
      );
      if (!next) break;
      names.push({ id, name: next.name });
      current = next;
    }
    return names;
  }, [path, root]);

  const onOpenFolder = (folder) => {
    setSelectedFileId(null);
    setPath((p) => [...p, folder.id]);
  };

  const onBackFolder = (indexInBreadcrumb) => {
    setSelectedFileId(null);
    setPath((p) => p.slice(0, indexInBreadcrumb + 1));
  };

  const onClickItem = (item) => {
    if (item.type === "folder") return onOpenFolder(item);
    setSelectedFileId(item.id);
  };

  const onAddClick = () => {
    alert("Placeholder: Add File/Folder (backend not wired yet).");
  };

  return (
    <div className="vaultPage">
      <div className="background-grain" />
      <div className="background-vignette" />

      <header className="vaultTop">
        <div className="vaultTitleRow">
          <div>
            <h1 className="vaultTitle">Vault</h1>
            <p className="vaultSubtitle">FAMILY ARCHIVE</p>
          </div>

          <div className="vaultNavBtns">
            <button className="ghostBtn" onClick={() => nav("/dashboard")}>
              Back
            </button>
            <button className="ghostBtn" onClick={() => nav("/")}>
              Home
            </button>
          </div>
        </div>

        <div className="resilienceCard">
          <div className="resilienceLeft">
            <div className="labelRow">
              <div className="label">Archive Resilience Score</div>

              <div className="helpWrap">
                <button
                  className="helpBtn"
                  type="button"
                  aria-label="Resilience score help"
                >
                  ?
                </button>
                <div className="helpTooltip" role="tooltip">
                  The Archive Resilience Score is the average of all file
                  Survivability Scores in your vault. Higher is better. Improve
                  it by adding metadata, redundancy, and durable formats.
                </div>
              </div>
            </div>
          </div>

          <div className={`scorePill ${scoreTone(resilienceScore)}`}>
            {resilienceScore}
            <span className="scoreSuffix">/100</span>
          </div>
        </div>
      </header>

      <main className="vaultMain">
        <section className="vaultBrowser">
          <div className="toolbar">
            <div className="breadcrumbs">
              {breadcrumb.map((b, idx) => (
                <React.Fragment key={b.id}>
                  {idx > 0 && <span className="crumbSep">{">"}</span>}
                  <button
                    className={`crumb ${
                      idx === breadcrumb.length - 1 ? "active" : ""
                    }`}
                    onClick={() => onBackFolder(idx)}
                  >
                    {b.name}
                  </button>
                </React.Fragment>
              ))}
            </div>

            <div className="toolbarRight">
              <button className="primaryBtn" onClick={onAddClick}>
                + Add
              </button>

              <div className="toggleGroup" role="group" aria-label="View mode">
                <button
                  className={`toggleBtn ${viewMode === "grid" ? "on" : ""}`}
                  onClick={() => setViewMode("grid")}
                >
                  Grid
                </button>
                <button
                  className={`toggleBtn ${viewMode === "list" ? "on" : ""}`}
                  onClick={() => setViewMode("list")}
                >
                  List
                </button>
              </div>
            </div>
          </div>

          <div className={`items ${viewMode}`}>
            {items.map((item) => {
              const isSelected = item.type === "file" && item.id === selectedFileId;
              const isFolder = item.type === "folder";

              return (
                <button
                  key={item.id}
                  className={`itemCard ${isSelected ? "selected" : ""}`}
                  onClick={() => onClickItem(item)}
                >
                  <div className="icon" aria-hidden="true">
                    {isFolder ? <FolderIcon /> : <FileIcon />}
                  </div>

                  <div className="meta">
                    <div className="nameRow">
                      <div className="name">{item.name}</div>

                      {!isFolder && (
                        <div className={`miniScore ${scoreTone(item.survivabilityScore)}`}>
                          {item.survivabilityScore}
                        </div>
                      )}
                    </div>

                    <div className="sub">
                      {isFolder
                        ? `${(item.children || []).length} items`
                        : `${item.format} • ${item.sizeMb} MB • ${item.lastModified}`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="vaultDetails">
          <div className="detailsCard">
            <div className="detailsTitle">Details</div>

            {!selectedFile ? (
              <div className="emptyState">
                <div className="emptyBig">Click a file</div>
                <div className="emptySmall">
                  Survivability score + metadata will show here.
                </div>
              </div>
            ) : (
              <>
                <div className="detailsHeader">
                  <div className="detailsName">{selectedFile.name}</div>
                  <div className={`scorePill ${scoreTone(selectedFile.survivabilityScore)}`}>
                    {selectedFile.survivabilityScore}
                    <span className="scoreSuffix">/100</span>
                  </div>
                </div>

                <div className="kv">
                  <div className="k">Format</div>
                  <div className="v">{selectedFile.format}</div>

                  <div className="k">Size</div>
                  <div className="v">{selectedFile.sizeMb} MB</div>

                  <div className="k">Last modified</div>
                  <div className="v">{selectedFile.lastModified}</div>

                  <div className="k">Tags</div>
                  <div className="v">
                    {(selectedFile.tags || []).length ? (
                      <div className="tags">
                        {selectedFile.tags.map((t) => (
                          <span key={t} className="tag">{t}</span>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>

                <button
                  className="ghostBtn full"
                  onClick={() => alert("Placeholder: Open viewer")}
                >
                  Open (placeholder)
                </button>
              </>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
