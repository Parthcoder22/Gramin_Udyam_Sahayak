# 🌾 Gramin Udyam Sahayak (ग्रामीण उद्यम सहायक)
### *AI-Powered Government Concessional Credit & Advisory Portal for Rural Micro-Enterprises*

---

## 📌 Overview

**Gramin Udyam Sahayak** is an end-to-end digital assistance portal designed to empower rural Indian micro-entrepreneurs. It demystifies government-backed concessional credit schemes (such as PMEGP, PMFME, and NBCFDC), computes exact loan eligibility with deterministic amortizing EMI math, generates hyper-local feasibility reports using **Retrieval-Augmented Generation (RAG)** over official Detailed Project Reports (DPRs), and offers vernacular voice input for accessible form completion.

---

## 🚀 Key Features

- **Dynamic Financial Engine & Scheme Routing**:
  - Automatically computes borrower equity (10% contribution), total project size ($100\%$), and subsidized loan eligibility ($90\%$).
  - **Deterministic Scheme Routing**:
    - **Micro Finance Scheme** ($\le ₹1,40,000$): Simplified KYC, 6.5% interest rate, 36-month tenure, 3-month grace period.
    - **Term Loan Scheme** ($> ₹1,40,000$): 8.0% interest rate, 84-month tenure, 6-month grace period.
  - Standard reducing-balance amortizing EMI calculator and CapEx/OpEx allocation split (70% Capital Expenditure vs 30% Working Capital).

- **Hyper-Local RAG Feasibility & Advisory Engine**:
  - Powered by **Supabase pgvector** (HNSW index) and **Google Gemini AI**.
  - Ingests and semantic-searches 45+ official government project profiles and guidelines across **Dairy & Livestock**, **Handloom & Textiles**, **Agro-Processing**, **Grocery & Retail**, and **Handicrafts**.
  - Generates verified market catchment numbers, regional subsidy opportunities (PMFME, ODOP, KVK), SWOT analysis, severity-tagged local risks, and pricing benchmarks.

- **Vernacular Voice Auto-Fill**:
  - Integrated voice recognition supporting Hindi, English, and Hinglish.
  - Converts spoken intent (e.g., *"Main Rampur mein dairy kholna chahta hoon, mere paas pandrah hazar rupaye hain"*) directly into structured form fields (`location`, `marginMoney`, `businessCategory`).

- **Loan Application Flow & Resilience**:
  - Secure submission into Supabase PostgreSQL table `loan_applications` protected by Row Level Security (RLS).
  - Built-in fail-safe session storage and offline fallback modes ensuring 100% uptime even if database or AI services experience transient interruptions.

- **Multilingual UI & Document Export**:
  - One-click language toggle between **English** and **Hindi (हिंदी)**.
  - Browser-native PDF print export for formal DPR documentation.

---

## 🏗️ Architecture & Tech Stack

```
                        ┌──────────────────────────────────────────────┐
                        │            React 19 + Vite Frontend          │
                        │   (Tailwind CSS v4, Lucide Icons, TSX)       │
                        └──────────────────────┬───────────────────────┘
                                               │ /api (Vite Proxy)
                                               ▼
                        ┌──────────────────────────────────────────────┐
                        │          Express.js Backend Server           │
                        │        (Node.js ESM, Multer, CORS)           │
                        └──┬───────────────────┬───────────────────┬───┘
                           │                   │                   │
                           ▼                   ▼                   ▼
                 ┌───────────────────┐ ┌───────────────┐ ┌───────────────────┐
                 │  Google Gemini AI │ │ OpenAI Whisper│ │ Supabase Postgres │
                 │ text-embedding-004│ │  (Voice Input │ │    (pgvector +    │
                 │  gemini-flash RAG │ │ Transcription)│ │   HNSW Indexing)  │
                 └───────────────────┘ └───────────────┘ └───────────────────┘
```

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite 6, TypeScript, Tailwind CSS v4, Lucide React Icons |
| **Backend** | Node.js (ESM), Express 4, Multer (in-memory audio processing), CORS, Dotenv |
| **Vector DB & Storage** | Supabase (PostgreSQL 15+), `pgvector` extension, HNSW cosine index, Row Level Security |
| **AI Models** | Google Gemini (`text-embedding-004` / `gemini-embedding-001`, `gemini-flash` / `gemini-3.6-flash`), OpenAI Whisper (`whisper-1`) |
| **Document Processing** | `pdf-parse` (safe ESM library import) |

---

## 📁 Repository Structure

```
gramin-udyam-sahayak/
├── data/                      # 45+ Government DPRs & Scheme Guidelines (PDF)
├── routes/
│   └── advisory.js            # RAG Advisory endpoint (Financial Engine + pgvector + Gemini)
├── scripts/
│   ├── ingest.js              # Production PDF ingestion pipeline into pgvector
│   └── rag_migration.sql      # Standalone SQL migration for Supabase SQL Editor
├── src/
│   ├── App.tsx                # Main single-page interactive portal & UI
│   ├── index.css              # Tailwind CSS v4 design system
│   └── main.tsx               # React application root
├── package.json               # Project scripts & dependencies
├── schema.sql                 # Complete database schema (tables, RLS, RPCs)
├── server.js                  # Express backend entry point
├── vite.config.ts             # Vite configuration with /api reverse proxy
└── .env.example               # Environment variable configuration template
```

---

## ⚙️ Getting Started

### 1. Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** (v9 or higher)
- A **Supabase** project account ([supabase.com](https://supabase.com))
- A **Google Gemini API Key** ([aistudio.google.com](https://aistudio.google.com/))

### 2. Installation
Clone the repository and install all dependencies:
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory (based on `.env.example`):
```env
# ── Gemini AI ────────────────────────────────────────────────
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

# ── Supabase ─────────────────────────────────────────────────
SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SECRET_KEY="your-supabase-service-role-secret-key"

# ── Server ───────────────────────────────────────────────────
PORT=3001

# ── Optional OpenAI Key (for Whisper voice transcription) ────
OPENAI_API_KEY="your-optional-openai-key"
```

---

## 🗄️ Database Setup (Supabase)

1. Open your **Supabase Dashboard → SQL Editor**.
2. Copy and paste the contents of [`schema.sql`](schema.sql) (or [`scripts/rag_migration.sql`](scripts/rag_migration.sql)).
3. Click **Run** to execute the script. This will:
   - Enable `vector` and `uuid-ossp` extensions.
   - Create `loan_applications` and `document_chunks` tables.
   - Build an **HNSW** index on `embedding vector_cosine_ops`.
   - Configure Row Level Security (RLS) policies.
   - Create the `match_document_chunks` semantic search RPC function.

---

## 📥 Ingesting Knowledge Base (RAG Pipeline)

To chunk all 45+ PDF DPRs located in `./data/`, generate 768-dimensional embeddings, and index them into Supabase:

```bash
npm run ingest
```

The ingestion pipeline automatically:
- Reads and normalizes text from all PDFs in `./data/`.
- Recursively splits text into ~800-character chunks with 150-character overlaps.
- Calls Gemini's embedding API in rate-limited batches with exponential backoff.
- Cleans prior chunks per file and bulk-inserts them into Supabase.

---

## 💻 Running the Application Locally

### Option A: Run Both Frontend & Backend Simultaneously (Recommended)
```bash
npm run dev:all
```
- **Frontend Portal**: `http://localhost:3000`
- **Backend API**: `http://localhost:3001`
- **API Health Check**: `http://localhost:3001/api/health`

### Option B: Run in Separate Terminals
1. **Terminal 1 (Backend Express Server)**:
   ```bash
   npm run server
   ```
2. **Terminal 2 (Frontend Vite Server)**:
   ```bash
   npm run dev
   ```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status check |
| `POST` | `/api/generate-advisory` | Performs financial calculation, queries pgvector, and generates feasibility report |
| `POST` | `/api/submit-application` | Validates borrower details and submits loan application into Supabase |
| `POST` | `/api/transcribe-voice` | Processes audio recording via Whisper/Gemini to extract form fields |

---

## 📄 License

This project is open-source and intended for rural micro-enterprise development and financial inclusion initiatives.
