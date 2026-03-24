# Ticket Management Application - FullStack

A full-stack Ticket Management System built with **FastAPI** (backend)
and **React + Vite + Tailwind CSS** (frontend).\
Supports role-based access, ticket lifecycle, assignment, comments,
filtering and statistics

---

## Tech Stack

### Backend

- **FastAPI** – REST API framework for building backend services
- **SQLAlchemy** – ORM for database models and queries
- **MySQL** – relational database
- **Docker** – used to run MySQL container
- **Pydantic** – request and response validation
- **JWT Authentication** – secure login and protected endpoints
- **Uvicorn** – ASGI server for running FastAPI

### Frontend

- **React** – component-based frontend library
- **Vite** – frontend development server and build tool
- **Tailwind CSS** – utility-first CSS framework for styling
- **Axios** – HTTP client for backend API calls
- **React Router DOM** – routing and layout navigation

---

## Features

### User Features

- Register & login
- Create tickets
- View own + assigned tickets
- View ticket details
- Add comments

### Admin Features

- View all tickets
- Assign tickets to users
- Update status & priority
- View users and their tickets
- Add comments

## Shared Features

- Ticket filtering (search, status, priority)
- Ticket details view
- Comments system
- Reusable UI components

---

## API Endpoints

### Authentication APIs

- `POST /api/v1/auth/register` Register a new user with name, email, and password.

- `POST /api/v1/auth/login-json` Login using email and password and receive JWT access token.

- `GET /api/v1/auth/me` Get current logged-in user

---

### User Ticket APIs

- `POST /api/v1/tickets` Create a new ticket.

- `GET /api/v1/tickets` Get all tickets created by the logged-in user.

- `GET /api/v1/tickets/{ticket_id}` Get full details of one ticket belonging to the logged-in user.

- `GET /api/v1/tickets/my` Get created + assigned tickets

---

### Admin APIs

- `GET /api/v1/admin/tickets` Get all tickets in the system.

- `PATCH /api/v1/admin/tickets/{ticket_id}` Update ticket status, priority assign user.

- `GET /api/v1/admin/users` Get all registered users.

- `GET /api/v1/admin/users/{user_id}/tickets` Get all tickets of a specific user.

- `GET /api/v1/admin/user-tickets` Get user-ticket mapping for admin view.

---

### Admin Statistics API

- `GET /api/v1/admin/dashboard-stats`

  Returns summary statistics (total, open, in-progress, closed, cancelled, and pripority-wise distribution)

---

### Comments APIs

- `GET /api/v1/tickets/{ticket_id}/comments` Get comments

- `POST /api/v1/tickets/{ticket_id}/comments` Add comment

---

## Project Structure

```text
ticket_booking_app/
├── backend/
│   ├── app/
│   │   ├── core/              # config, security
│   │   ├── models/            # DB models
│   │   ├── schemas/           # Pydantic schemas
│   │   ├── routers/           # API routes
│   │   │   ├── auth.py
│   │   │   ├── user.py
│   │   │   ├── admin.py
│   │   │   ├── tickets.py
│   │   │   ├── comments.py
│   │   └── main.py
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── api/               # axios calls
│   │   ├── components/        # reusable components
│   │   │   ├── TicketFilters.jsx
│   │   │   ├── TicketTable.jsx
│   │   │   ├── CommentsPanel.jsx
│   │   ├── contexts/          # auth context
│   │   ├── layouts/
│   │   ├── pages/             # dashboards & auth pages
│   │   ├── router/
│   │   └── styles/
│   └── package.json
│
└── README.md
```

---

## Steps to Run the Application

---

## Database Setup (MySQL in Docker)

This project uses **MySQL running inside a Docker container**.

### 1. Using Existing Container

If MySQL container is already running, we can create a new database inside the same container.

### Create a New Database

Run the following command:

```bash
docker exec -it <container_name> mysql -u root -p
```

Run the SQL command to create the new db for ticket management

    CREATE DATABASE ticket_management_db;


    SHOW DATABASES;

The backend .env settings should point to the correct database

    DATABASE_URL=mysql+pymysql://username:password@localhost:3306/ticket_management_db

---

### 2. Run the Backend

Open terminal and navigate to backend folder:

```bash
cd backend
```

Create a virtual environment for the project:

```bash
python -m venv venv
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run FastAPI server:

```bash
uvicorn app.main:app --reload
```

Backend will run at:

    http://127.0.0.1:8000

Swagger UI:

    http://127.0.0.1:8000/docs

---

### 3. Run the Frontend

Open another terminal and navigate to frontend folder:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Run the frontend:

```bash
npm run dev
```

Frontend will run at:

    http://127.0.0.1:5173
