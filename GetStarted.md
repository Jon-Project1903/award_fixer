# PatentAwards - Getting Started

## Prerequisites
- Python 3.11+
- Node.js 18+
- macOS (developed/tested on Mac)

## Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs at http://localhost:8000. API docs at http://localhost:8000/docs.

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173 and proxies API requests to the backend.

## Usage

1. Open http://localhost:5173
2. Create a new project (e.g., "CY2025 Awards Review")
3. Upload `data/db_source.csv` in the "Database Source" drop zone
4. Upload `data/unified.xlsx` in the "Unified Report" drop zone
5. Click "Run Matching" to cross-reference the data
6. Review flagged records - click any row to open the reconciliation detail
7. In the detail view, pick the correct values for title, date, and inventor names
8. Click "Save Choices" then "Mark Resolved" when done
9. Click "Export CSV" to download the final reconciled data

## How Matching Works

- Patent numbers are normalized by extracting the numeric part (e.g., `US-12469191-B2` and `US12469191` both become `12469191`)
- Design patents keep the D prefix (`USD1106263` -> `D1106263`)
- Dates are normalized across formats (`11/11/25` and `2025-11-11T00:00:00` are recognized as the same date)
- Inventor names are matched using fuzzy matching that handles first/last name ordering (`Sam Doe` matches `Doe Sam`)
- Records auto-pass if score >= 85%, dates match, and inventor counts are equal
- Everything else is flagged for manual review

## Project Structure

```
awards/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── database.py          # SQLite setup
│   ├── models.py            # 7 database tables
│   ├── routers/             # API endpoints
│   └── services/            # Import & matching logic
├── frontend/
│   └── src/
│       ├── pages/           # 3 pages: Projects, Detail, Reconciliation
│       └── components/      # Reusable UI components
└── data/                    # Sample data files
```
