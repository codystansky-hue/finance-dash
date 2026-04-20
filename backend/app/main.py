from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import items, cashflow, plaid, schwab, manual, projection, timetracker

Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    schwab.start_callback_server()
    yield


app = FastAPI(title="Finance Dashboard API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(items.router)
app.include_router(cashflow.router)
app.include_router(plaid.router)
app.include_router(schwab.router)
app.include_router(manual.router)
app.include_router(projection.router)
app.include_router(timetracker.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to Finance Dashboard API"}
