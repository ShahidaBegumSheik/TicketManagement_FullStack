import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
from fastapi_pagination import add_pagination
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.database import Base, engine
from app.core.logging_config import setup_logging
from app.core.response import error_response
from app.models import *
from app.routers import (admin, auth, ticket, comment, notifications, ws, filter)

logger = setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Base.metadata.create_all(bind=engine)
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

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    path = request.url.path
    method = request.method

    try:
        response = await call_next(request)
        duration_ms = round((time.time() - start_time) * 1000, 2)

        logger.info(
            f"endpoint={method} {path} status={response.status_code} duration_ms={duration_ms}"
        )
        return response

    except Exception as exc:
        duration_ms = round((time.time() - start_time) * 1000, 2)

        logger.exception(
            f"endpoint={method} {path} status=500 error={str(exc)} duration_ms={duration_ms}"
        )
        raise


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    logger.warning(
        f"endpoint={request.method} {request.url.path} status={exc.status_code} error={exc.detail}"
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response(str(exc.detail)),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(
        f"endpoint={request.method} {request.url.path} status=422 error=validation_error"
    )
    return JSONResponse(
        status_code=422,
        content=error_response(
            "Validation failed",
            data=exc.errors(),
        ),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception(
        f"endpoint={request.method} {request.url.path} status=500 error={str(exc)}"
    )
    return JSONResponse(
        status_code=500,
        content=error_response("Internal server error"),
    )


app.include_router(auth.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(ticket.router, prefix="/api/v1")
app.include_router(comment.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(ws.router, prefix="/api/v1")
app.include_router(filter.router, prefix="/api/v1")


add_pagination(app)

