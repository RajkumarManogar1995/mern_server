# MERN Login/Register API

A Node.js authentication API built with Express 5 and MongoDB/Mongoose. It supports registration, login, cookie-based access and refresh tokens, viewing the signed-in user's profile, and changing a password.

## Project structure

```text
.
├── app.js
├── server.js
├── config/
│   ├── db.js
│   └── env.js
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

`node_modules/`, `.git/`, and the private `.env` file are intentionally omitted. There is no `services/` folder at this time; forgot-password and reset-password were removed.

## Request flow

1. `server.js` loads validated configuration, connects to MongoDB, and starts the HTTP listener.
2. `app.js` configures CORS, checks request origins, parses cookies and JSON, and mounts the user routes.
3. `routes/auth.js` maps each HTTP method and path to its controller. Private routes run `middleware/auth.js` first.
4. `controllers/authController.js` validates input, performs authentication operations, creates or rotates tokens, and sends responses.
5. `models/User.js` defines the stored user fields and password hashing.
6. Errors go to `middleware/errorHandler.js`, which sends a consistent JSON error response.

## File guide

### Startup and configuration

- **`server.js`** is the process entry point for `npm start` and `npm run dev`. It connects to the database before accepting requests and closes the HTTP and MongoDB connections on `SIGINT` or `SIGTERM`.
- **`app.js`** configures Express without starting a network listener. It applies an exact-origin CORS policy with credentials, rejects unsafe requests that do not come from the configured frontend origin, parses cookies and JSON (up to 10 KB), mounts routes, and installs error handlers.
- **`config/env.js`** loads `.env` from the project root and validates the port, MongoDB URI, JWT secret, and frontend origin. `JWT_SECRET` must be at least 32 bytes. `CLIENT_ORIGIN` must be one HTTP(S) origin only, with no path or trailing slash.
- **`config/db.js`** connects Mongoose to MongoDB using a URI supplied by the startup code.
- **`.env.example`** lists the local configuration keys. Copy it to `.env` and replace the JWT secret with a private random value. Never commit `.env`.
- **`.gitignore`** excludes installed dependencies and private environment files while keeping `.env.example` trackable.

### Routes and controllers

- **`routes/auth.js`** declares the API paths and applies authentication middleware to private endpoints.
- **`controllers/authController.js`** contains registration, login, refresh, password-change, and current-user logic. JWTs are not returned in JSON. The controller sends them only in HttpOnly cookies.

### Middleware

- **`middleware/auth.js`** reads the access token from the `accessToken` cookie, verifies its HS256 signature and expiry, loads the user, and checks the token version. Missing, invalid, expired, or revoked tokens receive an HTTP 401 response.
- **`middleware/HttpError.js`** represents expected HTTP errors with a status code and message.
- **`middleware/errorHandler.js`** converts application, JSON parsing, request-size, and Mongoose errors into JSON responses. Unexpected server errors are logged but their details are not returned to the client.

### User model

- **`models/User.js`** stores unique usernames and email addresses, the password hash, a token version, a refresh-token hash, and timestamps.
- Passwords and refresh-token hashes are excluded from ordinary database queries (`select: false`).
- A Mongoose `pre("save")` hook hashes a password with bcrypt only when it changes. `matchPassword()` compares a supplied password with its hash.
- `tokenVersion` invalidates old access and refresh tokens when a password changes.
- `refreshTokenHash` stores only a SHA-256 hash of the current refresh token, never the raw refresh token.
- Optimistic concurrency helps prevent simultaneous refresh requests from successfully rotating the same refresh token twice.

### Package files

- **`package.json`** defines the ES module project, Node.js 20+ requirement, dependencies, and `dev`/`start` scripts.
- **`package-lock.json`** locks the dependency versions installed by npm. Keep it committed and let npm update it when dependencies change.

## Authentication cookies

Successful registration and login set two cookies:

| Cookie | Lifetime | Purpose |
| --- | --- | --- |
| `accessToken` | 15 minutes | Authenticates API requests |
| `refreshToken` | 7 days | Rotates the session and issues new tokens |

Both are `HttpOnly`, `Secure`, and `SameSite=Strict`. JavaScript in the React app cannot read them. The refresh cookie is scoped to `/api/users/refresh-token`; the access cookie is sent to API paths. The refresh token is rotated on each refresh and its previous value becomes invalid.

Because the model stores one refresh-token hash per user, signing in again replaces that user's previous refresh session. This simple implementation supports one active refresh session per account.

### React client requests

The frontend must include credentials so the browser sends and accepts cookies:

```js
const response = await fetch("http://localhost:5000/api/users/login", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
```

Use `credentials: "include"` on authenticated requests, refresh calls, and other requests that need cookies. The browser supplies the `Origin` header; the API accepts unsafe methods only from the exact configured `CLIENT_ORIGIN`.

`Secure` cookies require HTTPS in production. Modern browsers generally allow Secure cookies on `localhost` for local development; use matching `localhost` hosts for the React app and API. If local cookie behavior differs in your browser, run local HTTPS rather than disabling `Secure`.

## API endpoints

All routes are prefixed with `/api/users`.

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| `POST` | `/register` | No | Create an account and set auth cookies |
| `POST` | `/login` | No | Verify credentials and set auth cookies |
| `POST` | `/refresh-token` | Refresh cookie | Rotate the refresh token and issue a new access token |
| `POST` | `/logout` | Access cookie | Invalidate the session and clear auth cookies |
| `GET` | `/me` | Access cookie | Return the current user's public profile |
| `PATCH` | `/change-password` | Access cookie | Change password and rotate the auth session |

### Register

`POST /api/users/register`

```json
{
  "username": "alex",
  "email": "alex@example.com",
  "password": "at-least-8-characters"
}
```

Returns HTTP `201` with `{ "user": { "id", "username", "email" } }` and sets the two auth cookies. Passwords must be at least 8 characters and no more than 72 UTF-8 bytes (bcrypt's input limit). Duplicate usernames or emails return HTTP `409`.

### Login

`POST /api/users/login`

```json
{
  "email": "alex@example.com",
  "password": "your-password"
}
```

Returns HTTP `200` with the public user fields and sets the auth cookies. Tokens are not included in the JSON body. Existing users with shorter passwords can still log in; new passwords must meet the current minimum.

### Refresh session

`POST /api/users/refresh-token`

Send this request with `credentials: "include"`. The browser sends the HttpOnly refresh cookie automatically. The API verifies the token, checks its stored hash and token version, rotates it, and sets new access and refresh cookies. The response body is `{ "message": "Session refreshed" }`. Invalid or reused refresh tokens return HTTP `401` and clear the auth cookies.

### Logout

`POST /api/users/logout`

Send the request with `credentials: "include"`. The API requires a valid access cookie, increments the user's token version, removes the stored refresh-token hash, clears both HttpOnly cookies, and returns `{ "message": "Logged out successfully" }`. This invalidates the current access and refresh tokens.

### Current user

`GET /api/users/me`

Send the request with `credentials: "include"`. The access cookie authenticates the request. Returns only `id`, `username`, and `email`; never the password hash or tokens.

### Change password

`PATCH /api/users/change-password`

Send the request with `credentials: "include"` and this JSON body:

```json
{
  "currentPassword": "your-current-password",
  "newPassword": "your-new-password"
}
```

After verifying the current password, the API saves the new bcrypt hash, invalidates previous tokens, sets a fresh access and refresh cookie pair, and returns the public user. Existing six-character passwords remain valid as the current password; the new password must be at least 8 characters and no more than 72 UTF-8 bytes.

There is no forgot-password or reset-password endpoint.

The frontend should call the logout endpoint before clearing its in-memory user state. If the network request fails, do not report the server session as revoked; show an error or retain a retry option.

## Local setup

1. Install Node.js 20 or later and run MongoDB locally or use a hosted MongoDB URI.
2. Install dependencies from the project root:

   ```sh
   npm install
   ```

3. Copy `.env.example` to `.env`. Set your database URI, exact React development origin, and a random secret with at least 32 bytes. For example, generate a secret with:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Example configuration:

   ```env
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/mern_login_register
   JWT_SECRET=paste-a-generated-secret-here
   CLIENT_ORIGIN=http://localhost:5173
   ```

   Set `CLIENT_ORIGIN` to the exact origin of your React app. Do not add a path or trailing slash. Keep `.env` private.

4. Start the development server:

   ```sh
   npm run dev
   ```

   For a regular start, run `npm start`. The API listens only after the MongoDB connection succeeds.

## Notes and limitations

- Access tokens expire after 15 minutes and refresh tokens after 7 days. Changing `JWT_SECRET` invalidates all sessions.
- Cookies use `SameSite=Strict` as requested. The frontend and backend must be same-site for browser cookie delivery; unrelated cross-site deployments need a different cookie policy and additional CSRF protections.
- This project currently has no rate limiting, automated test suite, multi-device refresh-token storage, or forgot-password flow. Consider adding rate limiting and tests before exposing it publicly.
