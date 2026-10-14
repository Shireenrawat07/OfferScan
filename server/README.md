# OfferLens Backend

Express API for OfferLens health checks, URL reputation lookups, cookie-based accounts, and private analysis history.

## Requirements

Use Node.js 20.19+ or 22.12+, which is required by the project's Vite 8 frontend. The backend also uses Node's built-in `fetch`; no additional HTTP client package is needed.

## Install

From the OfferLens project root, install the frontend and backend dependencies:

```powershell
npm install
cd server
npm install
```

## Configure backend environment

The backend reads its configuration from the existing `server/.env`. Required variable names are `MONGODB_URI`, `JWT_SECRET`, and `FRONTEND_ORIGIN`; `PORT` and `NODE_ENV` configure the server, and `VIRUSTOTAL_API_KEY` enables VirusTotal lookups. Keep the existing values in that file; never copy it to the frontend or commit it. The app reports the name of a missing required variable without printing its value. VirusTotal is optional and only checks existing reputation reports.

## Create and connect a MongoDB Atlas database

1. Sign in to MongoDB Atlas, select or create a project, and create a cluster/deployment.
2. In the project's **Security > Database & Network Access** area, create a database user for OfferLens. This database user is separate from your Atlas website login. Give the app only the database permissions it needs.
3. In **Network Access**, add your current IP address for local development. For a deployed app, add the backend server's outbound IP. Avoid allowing access from every IP.
4. In the cluster's **Connect** dialog, choose the Node.js driver and copy the connection string. Replace the username and password placeholders. If the password includes reserved URL characters, URL-encode them.
5. Paste the Atlas URI into `MONGODB_URI` in `server/.env`. Preserve any existing value until its replacement is ready. Mongoose connects before Express begins listening and exits with a safe error if Atlas is unavailable.

```powershell
notepad server/.env
```

Mongoose connects before Express begins listening. If the URI is missing or Atlas rejects the connection, the backend prints a safe configuration error and exits instead of starting without MongoDB.

## Accounts and saved history

- `POST /api/auth/register` and `POST /api/auth/login` create an HttpOnly cookie session. Passwords are stored as bcrypt hashes.
- `GET /api/auth/me` checks the current session. `POST /api/auth/logout` invalidates it and clears the cookie.
- `POST /api/analysis`, `GET /api/analysis`, `GET /api/analysis/:id`, and `DELETE /api/analysis/:id` require a signed-in user. Each query is scoped to that user's ID.
- Results are stored only when the user clicks **Save to history**. Records include score, level, findings, recommendations, time, and optional hostname. Messages, files, quoted evidence, email addresses, and full URLs are not saved.
- Visitors can use the analyzer without an account. Saving and history require an account.
- Set `FRONTEND_ORIGIN` to the exact frontend origin(s), separated by commas. Use HTTPS and `NODE_ENV=production` when deployed. Strict same-site cookies work best when frontend and backend share a site.

The frontend uses `VITE_API_BASE_URL` and defaults to `http://localhost:5000`. To override it, copy the project root template to `.env.local` and edit the value:

```powershell
Copy-Item .env.example .env.local
```

## Run the app

Open two terminals in the OfferLens project root.

**Terminal 1 - backend:**

```powershell
cd server
npm run dev
```

For a normal start without auto-restart, use `npm start` from `server/` instead.

**Terminal 2 - frontend:**

```powershell
npm run dev
```

## Endpoints

### Health

```http
GET /api/health
```

Example:

```powershell
Invoke-RestMethod -Uri http://localhost:5000/api/health
```

When MongoDB is connected, the response includes `database.connected: true`. The endpoint returns HTTP 503 if the database connection is unavailable.

### URL reputation

```http
POST /api/links/check
Content-Type: application/json

{"url":"https://example.com"}
```

Example from PowerShell:

```powershell
Invoke-RestMethod -Uri http://localhost:5000/api/links/check `
  -Method Post `
  -ContentType 'application/json' `
  -Body '{"url":"https://example.com"}'
```

The route accepts absolute HTTP or HTTPS URLs up to 2,048 characters. It checks VirusTotal's existing URL report; it does not submit a new scan. A missing report is returned as `no_data`, which does not mean the URL is safe. Invalid inputs return 400, overlong URLs return 413, a missing server key returns 503, and VirusTotal rate limits are returned as 429.

VirusTotal receives the full URL, including its path and query string. Its API guidance says queried indicators may be scanned and added to its dataset, so avoid checking links with access tokens or confidential information. The public API is restricted to noncommercial use and has a default limit of four requests per minute. Review [VirusTotal API guidance](https://docs.virustotal.com/docs/api-overview) before deploying.

A VirusTotal result is a reputation signal, not a guarantee that a URL is safe.

