from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import Base, engine
from app.routers import (admin, auth, ticket)

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    lifespan=lifespan,
    title="Ticket Management",
    version="1.0.0",
    description="""
This API supports:

### User Features
- Authentication
- Ticket Creation
- View Tickets

### Admin Features
- View User Tickets
- User Ticket Management

### Technology Stack

Backend
- FastAPI
- SQLAlchemy
- MySQL 8+
- JWT authentication

Frontend
- React
- tailwindCSS

""",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(ticket.router, prefix="/api/v1")

