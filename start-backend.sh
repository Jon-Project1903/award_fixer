#!/bin/bash
cd "$(dirname "$0")/backend"

if [ ! -d "venv" ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv venv
fi

source venv/bin/activate
pip install -q -r requirements.txt
echo "Starting backend at http://localhost:8000"
uvicorn main:app --reload --port 8000
