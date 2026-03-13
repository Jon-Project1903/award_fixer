from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import create_db_and_tables
from routers import projects, imports, reconciliation, export

app = FastAPI(title="PatentAwards API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(imports.router)
app.include_router(reconciliation.router)
app.include_router(export.router)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()
