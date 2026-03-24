from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import items, cashflow

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Finance Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(items.router)
app.include_router(cashflow.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to Finance Dashboard API"}
