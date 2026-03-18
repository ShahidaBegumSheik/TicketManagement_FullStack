# Ticket Management Frontend

A Vite + React + Tailwind CSS frontend with three role-oriented layouts:

- Registration / Login
- Admin Panel
- User Panel

## Tech stack

- Vite
- React
- React Router DOM
- Axios
- Tailwind CSS

## Setup

1. Extract the project.
2. Open the project folder in terminal.
3. Install packages:
   ```bash
   npm install
   ```
4. Create `.env` from `.env.example` and set your backend URL.
5. Start development server:
   ```bash
   npm run dev
   ```

## Expected backend routes

This frontend assumes these APIs exist:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /tickets`
- `GET /tickets`
- `GET /tickets/:id`
- `GET /admin/tickets`
- `PATCH /admin/tickets/:id`

## Notes

- Login supports either a response containing `access_token` and `user`, or `access_token` alone followed by `GET /auth/me`.
- The admin and user panels switch content by changing React state, so previously displayed menu content is unmounted when a new item is chosen.
