# Eagle Box Cricket

Eagle Box Cricket is a production-style cricket venue booking platform for branch-based ground reservations. Customers can select a branch, choose a date and time, and book an available ground automatically.

## Project Overview

This project is a practical venue booking application for cricket grounds. The current focus is on a clean booking workflow, persistent storage, admin operations, and production deployment readiness.

## Features

- Branch-based booking flow
- Date and time selection
- Automatic ground allocation across the selected branch
- Conflict detection for overlapping bookings
- PostgreSQL-backed persistence for bookings, users, feedback, and cancellations
- Customer and admin dashboards
- Email notifications for booking and cancellation updates

## Technology Stack

### Frontend

- React
- Vite
- CSS

### Backend

- Node.js
- Express
- PostgreSQL

## Folder Structure

```text
frontend/
  src/
  public/
  package.json
backend/
  src/
  server.js
  package.json
  .env.example
  init.sql
```

## Setup Instructions

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd eaglebox
```

### 2. Frontend setup

```bash
npm install
npm run dev
```

### 3. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Update the backend environment variables with your local PostgreSQL and email configuration.

### 4. Create the database

Run the SQL in `backend/init.sql` against your PostgreSQL database.

### 5. Start the backend

```bash
node server.js
```

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and set:

```env
DATABASE_URL=postgresql://user:password@host:5432/eaglebox?sslmode=require
JWT_SECRET=change-this-to-a-long-random-secret
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
EMAIL_USER=your-smtp-username@gmail.com
EMAIL_PASS=your-smtp-app-password
EMAIL_FROM=Eagle Box Cricket <no-reply@eagleboxcricket.com>
ADMIN_EMAIL=admin@eagleboxcricket.com
PORT=5000
```

For the frontend, set `VITE_BACKEND_URL` and `VITE_GOOGLE_CLIENT_ID` during local development and deployment.

Do not commit your real `.env` files. Keep them local only.

## Future Enhancements

- Deployment to Vercel, Render, and Neon
