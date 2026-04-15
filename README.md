# Ticket Management Application - FullStack

A full-stack Ticket Management System built with **FastAPI** (backend)
and **React + Vite + Tailwind CSS** (frontend).\
Supports role-based access, ticket lifecycle, assignment, comments,
filtering and statistics. Enhanced with real-time features, optimized APIs, and production-level architecture.

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
- **WebSocket** - Real time notifications
- **smtplib** - for sending mails

### Frontend

- **React** – component-based frontend library
- **Vite** – frontend development server and build tool
- **Tailwind CSS** – utility-first CSS framework for styling
- **Axios** – HTTP client for backend API calls
- **React Router DOM** – routing and layout navigation
- **Chart.js** - to create visual charts

---

## Features

### User Features

- Register & login
- Create tickets - Only Users can create tickets, Support Agents cannot create tickets
- Add attachments for the created tickets
- View own + assigned tickets
- View ticket details
- Add comments
- Reopen a closed ticket as a Support Agent
- Check if duplicate ticket is already created

### Admin Features

- View all tickets
- Assign tickets to users
- Update status & priority
- View users and their tickets
- Add comments
- Change the role of the User to Support Agent and Vice Versa

## Shared Features

- Ticket filtering (search, status, priority)
- Ticket details view
- Comments system
- Reusable UI components

---

## Advanced Features (Real-Time & Optimization) - Phase 1

### Real-Time Notifications

- FastAPI WebSockets
- Triggered on ticket events
- Bell icon with unread count

### Comments System

- User/Admin/Support Agent
- Chat-style UI with timestamps

### Activity Timeline

- Full audit trail of ticket lifecycle

### File Upload

- Images & PDFs (max 5MB)
- Linked to tickets

### Dashboard Analytics

- Chart.js graphs
- CSV export

### Backend Pagination & Filtering

- Server-side filtering & search

### Support Agent Role

- Restricted access role

### Ticket Enhancements

- Auto escalation
- Reopening with reason
- Duplicate detection

### Email Notifications

- SMTP-based alerts

### API Optimization

- Indexed queries
- joinedload optimization
- rate limiting

### UI/UX Enhancements

- Notifications
- Loading states
- Error handling

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

- `GET /api/v1/tickets/duplicate-check` Get duplicate tickets with similar title and/or description

- `POST /api/v1/tickets/{ticket_id}/attachments` - Add attachements for a ticket

- `GET /api/v1/tickets/{ticket_id}/attachments/{attachment_id}` - Get the attachment for a specific ticket

- `POST /api/v1/tickets/{ticket_id}/reopen` - User can reopen a closed ticket giving a reason

---

### Admin APIs

- `GET /api/v1/admin/tickets` Get all tickets in the system.

- `PATCH /api/v1/admin/tickets/{ticket_id}` Update ticket status, priority assign user.

- `GET /api/v1/admin/users` Get all registered users.

- `GET /api/v1/admin/users/{user_id}/tickets` Get all tickets of a specific user.

- `GET /api/v1/admin/user-tickets` Get user-ticket mapping for admin view.

- `PUT /api/v1/admin/users/{user_id}/role` Update User role to Support Agent or to User

---

### Admin Statistics API

- `GET /api/v1/admin/dashboard-stats`

  Returns summary statistics (total, open, in-progress, closed, cancelled, and pripority-wise distribution)

- `GET /api/v1/admin/dashboard-analytics` Get tickets per day, Status & Priority distributions, Avg resolutions, active users

- `GET /api/v1/admin/export` - Export the admin tickets stats to csv file

---

### Comments APIs

- `GET /api/v1/tickets/{ticket_id}/comments` Get comments

- `POST /api/v1/tickets/{ticket_id}/comments` Add comment

### Notifications APIs

- `GET /api/v1/notifications` Get notifications

- `POST /api/v1/notifications/{notification_id}/read` Mark notification as read

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
│   │   │   ├── ticket.py
│   │   │   ├── comment.py
│   │   │   ├── notifications.py
│   │   │   └── ws.py
│   │   ├── services/         # Business Logic for tickets
│   │   │   ├── ticketing.py
│   │   │   ├── notification_service.py
│   │   └── main.py
│   │   ├── uploads/           # Issue screen shot uplaod for ticket creation
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── api/               # axios calls
│   │   ├── components/        # reusable components
│   │   │   ├── TicketFilters.jsx
│   │   │   ├── TicketTable.jsx
│   │   │   ├── CommentsPanel.jsx
│   │   │   ├── NotificationBell.jsx
│   │   │   ├── ChartCard.jsx
│   │   │   ├── StatsCard.jsx
│   │   │   ├── AttachmentList.jsx
│   │   │   └── ActivityTimeline.jsx
│   │   │   ├── TicketCard.jsx
│   │   │   ├── TicketFilters.jsx
│   │   │   ├── TicketTable.jsx
│   │   │   ├── LoadingState.jsx
│   │   │   ├── ProfileForm.jsx
│   │   │   ├── SectionHeader.jsx
│   │   ├── contexts/          # auth context
│   │   ├── layouts/
│   │   ├── pages/             # dashboards & auth pages
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── UserDashboard.jsx
│   │   │   ├── NotFoundPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   └── LoginPage.jsx
│   │   ├── router/
│   │   │   └── routes.jsx
│   │   └── styles/
│   │   │   └── index.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── uploads/ (for file storage)
├── README.md
└── .gitignore
```

---

# Backend Enhancements – Phase 2

## Overview

This phase enhances the Ticket Management System with advanced backend capabilities for scalability, performance, and better user experience.

---

# 1. Tags System

## Description

Tickets can now have multiple tags (e.g., Bug, Feature, Urgent).

## Features

- Add multiple tags to a ticket
- Filter tickets by tags
- Many-to-many relationship

## Database Design

```
tags table
ticket_tags (mapping table)
```

## APIs

- Add tags during ticket creation/update
- Filter tickets using query params:

```
GET /api/v1/tickets?tags=bug,urgent
```

---

# 2. Saved Filters

## Description

Users can save frequently used filters.

## Features

- Save custom filter views
- Apply saved filters quickly

## Example

- "My Open Tickets"
- "High Priority Issues"

## Database

```
saved_filters table
```

## APIs

- Save filter:

```
POST /api/v1/filters
```

- Get filters:

```
GET /api/v1/filters
```

---

# 3. Bulk Actions

## Description

Perform actions on multiple tickets at once.

## Features

- Bulk status update
- Bulk assignment
- Bulk delete

## APIs

```
POST /api/v1/admin/tickets/bulk/status
POST /api/v1/admin/tickets/bulk/assign
POST /api/v1/admin/tickets/bulk/delete
```

## Example Payload

```
{
  "ticket_ids": [1,2,3],
  "status": "closed"
}
```

---

# 4. Soft Delete & Restore

## Description

Tickets are not permanently deleted.

## Features

- Soft delete (is_deleted flag)
- Admin-only deleted view
- Restore functionality

## APIs

```
DELETE /api/v1/admin/tickets/{id}
GET /api/v1/admin/tickets/deleted
POST /api/v1/admin/tickets/{id}/restore
```

---

# 5. Advanced Search

## Features

- Full-text search
- Keyword matching
- Relevance-based results

---

# 6. Caching (Performance)

## Features

- Redis / in-memory caching
- Cache ticket list & analytics
- Cache invalidation on update

---

# 7. Modular Architecture

## Structure

- Routers → API layer
- Services → Business logic
- Repositories → DB queries

---

# 8. API Versioning

## Structure

```
/api/v1/
```

Supports future upgrades without breaking existing APIs.

---

# 9. Logging & Monitoring

## Features

- Structured logging
- Tracks:
  - Requests
  - Errors
  - Endpoints

---

# 10. Validation & Standards

## Features

- Pydantic validation
- Consistent response format:

```
{
  "status": "success",
  "message": "...",
  "data": {}
}
```

---

# Summary of Phase 2 Enhancements

This phase upgrades the system to:

- Scalable architecture
- Optimized performance
- Advanced filtering & search
- Production-ready backend design

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
