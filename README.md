# Domus Memoriae

> **A Home for Time Should Never Erase**
> 
> A secure, generational digital heirloom that actively monitors and preserves your family's most treasured files against time and format obsolescence.

![Domus Memoriae Logo](client/public/favicon_dm.png)

---

## Inspiration
Traditional cloud storage is often treated like a digital junk drawer—files go in, get forgotten, and formats silently become obsolete over time. As our lives become increasingly digital, we realized we are at a severe risk of losing our family histories to "data rot" and inaccessible file types. 

Developed for **CalgaryHacks 2026**, Domus Memoriae was built in direct response to **Topic 2: "Preserve Today for Tomorrow: Why Archives Matter"**. We wanted to rethink digital storage not as a temporary hard drive, but as a permanent, living archive that actively fights to keep your data readable for future generations.

---

## What It Does
Domus Memoriae is a **family archive platform** that provides a centralized, highly secure "Vault" for your legacy. Rather than passively holding files, it actively evaluates their health to ensure they survive for decades.

It serves as a collaborative space for families:
* **The Vault** — A secure, shared environment where families can pool photos, videos, audio, and critical documents.
* **The Archive Engine** — An automated system that calculates "Resilience" and "Access Risk" scores, warning users if a specific file format is in danger of becoming unreadable in the future.

### Key Features
* **Archive Resilience & Risk Scoring:** Real-time evaluation of how "at-risk" a file is based on its extension, metadata richness, and duplicate counts.
* **Safe Full-Screen Previews:** Strict MIME-type enforcement allows users to safely preview PDFs, text documents, images, and video directly in the browser without triggering unwanted downloads.
* **Family Collaboration:** Easily generate and share secure join codes to invite family members to view and contribute to the archive.
* **Timeless UI/UX:** A distraction-free, elegant interface built with a vintage parchment-and-ink aesthetic using *Cormorant Garamond* and *Crimson Text* typography.

---

## Survivability & Resilience Scoring

One of the core innovations of Domus Memoriae is its **living health system** — every file uploaded to a vault is continuously evaluated for its long-term survivability, and the vault as a whole receives an aggregate resilience score.

### File Survivability Score (0–100)
Each file is assigned a **Survivability Score** from 0 to 100 that reflects its likelihood of remaining accessible and uncorrupted over decades. A higher score means a healthier, more future-proof file. The score is computed from several signals:

| Signal | Description |
| :--- | :--- |
| **Format Risk** | File extensions are classified as `low`, `medium`, or `high` risk based on their historical obsolescence rates. Modern open formats (`.mp4`, `.png`, `.pdf`) score low risk; legacy or proprietary formats (`.doc`, `.bmp`, `.swf`) score high. |
| **Metadata Quality** | Rich metadata (author, title, creation date, description) earns a higher metadata score. PDFs have their internal metadata extracted automatically via `pypdf`. Files with sparse or missing metadata are penalized. |
| **MIME Type Integrity** | The claimed MIME type (from the browser) is compared against the detected MIME type (via `python-magic`). A mismatch triggers a significant risk penalty, as it may indicate corruption or a disguised file. |
| **Duplicate Redundancy** | Files with duplicates stored within the vault receive a small resilience bonus — redundancy improves long-term survival odds. |
| **File Age** | The age of the file in days is factored in as a proxy for how long it has persisted without intervention. |
| **Access Frequency** | Files that have been accessed more frequently are considered more "active" and score slightly better. |

Scores are displayed prominently on every file card and in the file detail panel, colour-coded for instant readability:
- 🟢 **85–100** — Excellent survivability
- 🟡 **65–84** — Moderate risk, consider re-encoding or enriching metadata
- 🔴 **0–64** — High risk, action recommended

### Vault Resilience Score (0–100)
The **Vault Resilience Score** is the average survivability score across all files in the vault. It is recalculated automatically each time a file is uploaded, giving families an at-a-glance health indicator for their entire archive. It appears at the top of the Vault view and updates in real time.

---

## ML Regression Model

The survivability scoring system is powered by a **Random Forest Regressor** trained on a purpose-built synthetic dataset that simulates realistic family archive conditions across a wide range of file types, ages, and metadata completeness levels.

### Training Data
Because no real-world labelled dataset of "file survivability over time" exists, we generated a **synthetic dataset** (`data.csv`) that encodes domain knowledge about archival best practices. Each row represents a simulated file record with the following features and a ground-truth survivability score derived from archival science heuristics:

| Feature | Type | Description |
| :--- | :--- | :--- |
| `ext` | Categorical | File extension (e.g., `jpg`, `pdf`, `docx`) |
| `file_type` | Categorical | Broad category: `image`, `video`, `document`, `audio`, `other` |
| `format_risk` | Categorical | Obsolescence risk tier: `low`, `medium`, `high` |
| `size_bytes` | Numeric | File size in bytes |
| `metadata_score` | Numeric | 0–100 score for metadata completeness |
| `access_risk_score` | Numeric | 0–100 penalty score based on MIME mismatch and metadata gaps |
| `duplicate_count` | Numeric | Number of identical files already in the vault |
| `access_count` | Numeric | How many times the file has been accessed |
| `file_age_days` | Numeric | Days since upload |
| `mime_mismatch` | Binary | `1` if claimed and detected MIME types differ, else `0` |

### Model Architecture
The model is implemented as a **scikit-learn `Pipeline`** composed of:
1. **`ColumnTransformer`** — applies `SimpleImputer` (median strategy) to numeric columns and `OneHotEncoder` to categorical columns, so the model handles any unseen file extension gracefully.
2. **`RandomForestRegressor`** — 300 estimators, max depth of 15, trained with `min_samples_leaf=2` to prevent overfitting on the synthetic data.

Training uses an 80/20 train/test split. The model is evaluated on MAE, RMSE, and R², and prediction accuracy is reported at ±5, ±10, and ±15 point thresholds.

### Inference & Fallback
At upload time, `app.py` extracts the 10 features above and passes them to the trained model (`model.pkl`) for a real-time prediction. If the model file is unavailable, the system gracefully falls back to a **rule-based heuristic** (inverse of access risk score, adjusted for metadata quality and redundancy) so scoring always works, even in a cold deployment.

---

## How We Built It

### Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, React Router v6, Custom CSS (Variables, Flexbox, Grid) |
| **Typography** | Google Fonts — *Cormorant Garamond* & *Crimson Text* |
| **Backend** | Python 3, Flask, Flask-CORS |
| **Database** | MongoDB (via PyMongo) |
| **Authentication** | WebAuthn / Passkeys (passwordless — Face ID, Touch ID, Windows Hello) |
| **File Handling** | Multipart form data, `python-magic` for MIME detection, `werkzeug` for secure storage |
| **PDF Parsing** | `pypdf` for automatic internal metadata extraction |
| **ML / Scoring** | scikit-learn `RandomForestRegressor` + `Pipeline`, pandas, NumPy |
| **Hashing** | SHA-256 for duplicate detection and file integrity |
| **Environment** | `python-dotenv`, configurable for local dev and Railway/Vercel production |

### Architecture
* **Frontend SPA:** The React application handles dynamic view switching, routing, and complex Blob processing to force inline file rendering (preventing auto-downloads for text and PDF formats).
* **Smart Uploads:** When a file is uploaded, the backend generates a `sha256` hash to detect duplicates and prevent vault bloat.
* **Database Schema:** Tracks claimed vs. detected MIME types, file sizes, access counts, and calculated risk reasons to maintain the overarching "health" of the Vault.
* **ML Pipeline:** A trained `model.pkl` is loaded at server startup. Features are extracted per-file at upload time and fed to the pipeline for a sub-millisecond survivability prediction.

---

## The Archivists
> A collaboration built during CalgaryHacks 2026, focused on **longevity, digital heritage, and building software that outlasts us.**

| Team Member | GitHub Profile |
| :--- | :--- |
| **Tarun Jaswal** | [@tjasw549](https://github.com/tjasw549) |
| **Ochihai Omuha** | [@oomuh570](https://github.com/oomuh570) |
| **Abiola Raji** | [@Abiolr](https://github.com/Abiolr) |
