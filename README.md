# MERN Login/Register API

A small Node.js authentication API built with Express 5 and MongoDB/Mongoose. It supports user registration, login, viewing the signed-in user's profile, and changing a password.

## Project structure

```text
.
├── app.js
├── server.js
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
├── .env.example
├── .gitignore
├── package.json
└── package-lock.json
```

`node_modules/`, `.git/`, and the real `.env` file are intentionally omitted from this tree. `services/` currently has no files: the password-reset email service was removed along with the forgot-password and reset-password features.

## How a request moves through the app

1. `server.js` loads environment variables, validates startup configuration, connects to MongoDB, and starts the HTTP listener.
2. `app.js` builds the Express application, installs JSON parsing, and mounts the user routes.
3. `routes/auth.js` matches the HTTP method and URL, and attaches authentication middleware to protected endpoints.
4. `middleware/auth.js` validates a bearer token and loads the authenticated user.
5. `controllers/authController.js` validates request data, performs the authentication operation, and sends the response.
6. `models/User.js` defines how user data is stored and how passwords are hashed and checked.
7. Errors thrown by asynchronous handlers are sent to `middleware/errorHandler.js`, which creates the JSON error response.

## What each file does

### Entry point and Express app

- **`server.js`** is the process entry point (`npm start` and `npm run dev`). It loads `.env` relative to this file, checks `PORT`, `MONGODB_URI`, and `JWT_SECRET`, connects to the database before accepting requests, and handles `SIGINT`/`SIGTERM` shutdown by closing the HTTP server and MongoDB connection.
- **`app.js`** configures Express without starting a listening server. It disables the `X-Powered-By` header, accepts JSON request bodies up to 10 KB, mounts the API at `/api/users`, and installs not-found and error middleware last. Keeping app setup separate from listening makes it easier to test.

### Configuration and database

- **`config/db.js`** contains the MongoDB connection helper. It receives the URI as an argument, connects with Mongoose, and logs the database host. Startup configuration remains in `server.js`; the database helper does not read environment variables itself.
- **`.env.example`** documents the required local variables. Copy it to `.env` and set a strong private JWT secret. `.env` is ignored by Git; do not publish its values.
- **`.gitignore`** excludes installed dependencies and local environment files while allowing `.env.example` to be committed.

### Routes and controllers

- **`routes/auth.js`** maps HTTP endpoints to controller functions. It does not contain database queries or authentication business logic.
- **`controllers/authController.js`** implements registration, login, change-password, and the current-user response. It normalizes email addresses, checks inputs, creates JWTs, and returns only public user fields.

### Middleware

- **`middleware/auth.js`** implements the `protect` middleware used on private endpoints. It expects `Authorization: Bearer <token>`, verifies the JWT using HS256, finds the user, and checks the token version. If the token is missing, invalid, expired, or stale, it throws an HTTP error.
- **`middleware/HttpError.js`** is a small error type that carries an HTTP status code with an error message. Controllers and middleware use it for expected client errors such as invalid input or missing authentication.
- **`middleware/errorHandler.js`** handles errors centrally. It maps malformed JSON, oversized request bodies, Mongoose validation/cast errors, and duplicate-key errors to suitable HTTP statuses. Unexpected server errors are logged and returned with a generic message rather than internal details. The not-found handler also lives here.

### User model

- **`models/User.js`** defines the MongoDB `User` schema: unique username and email, a password, a token version, and timestamps.
- The password field is excluded from normal Mongoose queries (`select: false`). Login and password-change code explicitly select it only when they need to check the current password.
- A `pre("save")` hook hashes the password with bcrypt only when it has changed. `matchPassword()` compares a submitted password against the stored hash.
- `optimisticConcurrency` helps prevent concurrent document saves from silently overwriting each other.
- `tokenVersion` is excluded from normal queries and included in signed-in tokens. Password changes increment it, invalidating previously issued tokens.

### Package files

- **`package.json`** declares the app as an ES module, lists dependencies, requires Node.js 20 or later, and defines scripts:
  - `npm run dev` runs Node's watch mode for local development.
  - `npm start` starts the server normally.
- **`package-lock.json`** records the exact dependency tree used by npm. Keep it in source control and update it through npm when dependencies change.

## API endpoints

All routes below are prefixed with `/api/users`.

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| `POST` | `/register` | No | Create an account |
| `POST` | `/login` | No | Verify credentials and receive a JWT |
| `GET` | `/me` | Bearer token | Return the signed-in user's public profile |
| `PATCH` | `/change-password` | Bearer token | Verify the current password and change it |

### Register

`POST /api/users/register`

```json
{
  "username": "alex",
  "email": "alex@example.com",
  "password": "at-least-8-characters"
}
```

On success, returns HTTP `201` with `id`, `username`, `email`, and a bearer `token`. The password must be at least 8 characters and no more than 72 UTF-8 bytes (bcrypt's input limit). Duplicate usernames or emails return HTTP `409`.

### Log in

`POST /api/users/login`

```json
{
  "email": "alex@example.com",
  "password": "your-password"
}
```

On success, returns HTTP `200` with the public user fields and a bearer token. Existing accounts with shorter passwords can still log in; the 8-character minimum is checked when registering or choosing a new password.

### Current user

`GET /api/users/me`

Send the JWT in the request header:

```http
Authorization: Bearer <token>
```

Returns the authenticated user's `id`, `username`, and `email`; never returns the password hash.

### Change password

`PATCH /api/users/change-password`

Requires the bearer token and a JSON body:

```json
{
  "currentPassword": "your-current-password",
  "newPassword": "your-new-password"
}
```

The API verifies the current password, enforces the new-password length limits, saves the new bcrypt hash, increments `tokenVersion`, and returns the public user fields plus a newly issued token. Use that returned token for subsequent requests; tokens issued before the change are invalidated.

There is no forgot-password or reset-password endpoint. A user who cannot authenticate must use an account recovery process added separately by the project owner.

## Local setup

1. Install Node.js 20 or later and MongoDB (local or hosted).
2. Install dependencies from the project root:

   ```sh
   npm install
   ```

3. Copy `.env.example` to `.env` and set the values:

   ```env
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/mern_login_register
   JWT_SECRET=replace-with-a-long-random-secret
   ```

   Generate a private random secret rather than keeping the example value. Keep `.env` out of version control.

4. Start the development server:

   ```sh
   npm run dev
   ```

   For a regular start, run `npm start`. The API listens on the configured port after a successful database connection.

## A few implementation details

- Express 5 forwards rejected promises from async route handlers to the error middleware. Controllers can throw `HttpError` instead of repeating `try/catch` and response code in every route.
- Expected client errors use 4xx statuses; unexpected server errors use 500 and do not expose internal error text in the response.
- JWTs are signed with HS256 and expire after 30 days. Keep `JWT_SECRET` private; changing it invalidates all existing JWTs.
- The API currently has no rate limiting, email verification, password-reset flow, or automated test suite. Consider adding rate limiting and tests before exposing it to public traffic.
