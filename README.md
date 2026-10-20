# mern_server

Simple backend app for login and signup endpoint creation using Node.js, Express, and MongoDB.

## Overview

This project provides a REST API for user authentication and account management, including:

- User registration
- User login
- JWT-based protected routes
- Password reset flow via email
- Password change for authenticated users
- MongoDB persistence with Mongoose

## Tech Stack

- Node.js 20+
- Express 5
- MongoDB + Mongoose
- JWT (jsonwebtoken)
- bcryptjs
- dotenv
- Resend email API for password reset emails

## Project Structure

```text
.
├── app.js
├── server.js
├── .env.example
├── package.json
├── config/
│   └── db.js
├── controllers/
│   └── authController.js
├── middleware/
│   ├── auth.js
│   ├── errorHandler.js
│   └── HttpError.js
├── models/
│   └── User.js
├── routes/
│   └── auth.js
├── services/
│   └── passwordResetEmail.js
└── README.md
```

## Features

### Authentication endpoints

Base URL: `/api/users`

- `POST /api/users/register` — Create a new user account
- `POST /api/users/login` — Authenticate and return a JWT token
- `GET /api/users/me` — Fetch the authenticated user
- `PATCH /api/users/change-password` — Change the logged-in user password
- `POST /api/users/forgot-password` — Request a password reset email
- `POST /api/users/reset-password` — Reset a password using a reset token

### Security behaviors

- Passwords are hashed before storage using `bcryptjs`
- JWT tokens are checked for validity and token version mismatch
- Requests without a valid token receive a 401 response
- Duplicate username/email values return a 409 conflict

## Environment Variables

Copy `.env.example` to a local `.env` file and update the values:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/mern_login_register
JWT_SECRET=replace-with-a-long-random-secret
RESEND_API_KEY=re_your_api_key
EMAIL_FROM=Your App <no-reply@example.com>
FRONTEND_URL=http://localhost:5173
```

### Variable explanations

- `PORT` — server port for the API
- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — secret used to sign access tokens
- `RESEND_API_KEY` — API key for sending password reset emails
- `EMAIL_FROM` — sender address used in reset emails
- `FRONTEND_URL` — frontend app URL used in reset-password links

## Installation

```bash
npm install
```

## Running the server

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

## Example Requests

### Register a user

```bash
curl -X POST http://localhost:5000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john",
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Login

```bash
curl -X POST http://localhost:5000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Use the token

```bash
curl http://localhost:5000/api/users/me \
  -H "Authorization: Bearer <your_jwt_token>"
```

## Notes

- The project uses the `type: module` setting in `package.json`, so ES module syntax is required in the source files.
- The app expects a running MongoDB instance before the server starts.
- Password reset emails require valid Resend configuration in the environment.

## License

This project is licensed under the ISC License.
