from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from fastapi_pagination import add_pagination
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.models import *
from app.routers import (admin, auth, ticket, comment, notifications, ws)

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

app.state.limiter = auth.limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
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
app.include_router(comment.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(ws.router, prefix="/api/v1")

add_pagination(app)

