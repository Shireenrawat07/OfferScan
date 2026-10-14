# OfferLens

OfferLens helps people review job offers and recruiter messages for potential warning signs.

## Risk scoring

OfferLens combines weighted, deduplicated evidence in one scoring pipeline. Each evidence group contributes at most its strongest signal. Independent groups combine using `100 × (1 − product(1 − weight/100))`, rounded to an integer, so repeated phrases and overlapping findings do not simply add together.

Message signals include recruitment payment demands (30), payment pressure or equipment-purchase demands (25), sensitive credential or personal-data requests (30), guaranteed employment promises (25), unsupported selection claims (8), manipulative registration urgency (15), reliably parsed expired deadlines (25), and risky software instructions (35). Payment-related findings share one group; urgency and expired deadlines share one group; selection claims and guaranteed-employment promises share one group. Expired dates are recognized only in ISO form or full month-name dates when paired with deadline wording. Ordinary stipends, certificates, benefits, and future deadlines do not independently add risk.

Email format and domain-pattern signals use their configured weights (invalid format 10, free provider 5, internationalized domain 12, unusual pattern 8) within one sender-domain group. A sender/link domain mismatch contributes 18 only for a non-public sender domain and a non-shortened, non-form destination that differs at its registrable domain. This is a review signal, not proof of impersonation.

Local URL signals are weighted by severity (5 low, 15 medium, 45 high). Per URL, VirusTotal malicious detections contribute 80 and suspicious detections contribute 35; the strongest finding for a canonical URL is counted once. Repeated URLs, including URLs that differ only by a fragment or default port, do not inflate the score. VirusTotal continues to look up existing reports with GET requests only; OfferLens does not submit scans or resolve redirects. A shortener alone contributes zero points and its hidden destination remains unverified.

Risk bands are Low (0–19), Moderate (20–44), High (45–69), and Very High (70–100). A clean VirusTotal report means no malicious or suspicious detections were present in that report; it is not a guarantee of safety. Missing reports, pending results, inconclusive reports, errors, rate limits, and skipped checks are unknown or unavailable and do not count as clean. When any URL check is incomplete, OfferLens labels the overall URL review incomplete. Wording-based checks are heuristic and cannot prove fraud or confirm that an offer is genuine.

## Run locally

Install dependencies from the project root and backend folder:

```sh
npm install
cd server && npm install
```

Start the API from the `server` folder with `npm run dev`, then start the frontend from the project root with `npm run dev`. The frontend uses `VITE_API_BASE_URL` when configured and otherwise connects to `http://localhost:5000`.

## Local configuration and deployment

### Required environment variables

- Frontend (Vite): `VITE_API_BASE_URL` is the backend origin, without `/api` (local default: `http://localhost:5000`). Set it in the Vercel project as a build-time environment variable. A safe local template is in `.env.example`; copy it to `.env.local` for local overrides.
- Backend (Render): `MONGODB_URI`, `JWT_SECRET`, and `FRONTEND_ORIGIN` are required. `PORT` is supplied by Render and defaults to 5000 locally. Set `NODE_ENV=production`. `VIRUSTOTAL_API_KEY` is optional; it remains backend-only and enables existing-report lookups. Configure each value privately in Render; never put backend secrets in Vercel variables or source control.

### Deploy to Render and Vercel

1. Push the source to GitHub only after reviewing the staged file list and confirming no real `.env` files are tracked. Git is not initialized in this project yet.
2. Create a Render **Web Service** from the repository, set its root directory to `server`, build command to `npm install`, and start command to `npm start`. Add the backend environment variables listed above. Render supplies `PORT`.
3. Create a Vercel project from the same repository with the project root as its root directory. Set `VITE_API_BASE_URL` to the deployed Render service origin (for example, `https://<your-service>.onrender.com`, with no `/api`). Vite embeds this value at build time; redeploy after changing it.
4. Set Render `FRONTEND_ORIGIN` to the exact Vercel deployment origin, including `https://` and excluding a trailing slash. For preview deployments, explicitly allow each origin you intend to use, comma-separated. Keep the API service and frontend on HTTPS.
5. In MongoDB Atlas, allow network access from the Render service and verify its database user can access the existing `OfferLens` database. Do not change the database name or schema for deployment.
6. After deployment, verify `/api/health`, register/login/logout, and private history in a browser. The production session cookie uses `SameSite=None; Secure` for the cross-site Vercel-to-Render setup; CORS and mutation-origin checks must use the exact frontend origin.

File text, PDF, DOCX, and image OCR extraction run in the browser; the backend receives analysis results for explicitly saved history, not the uploaded source files. No server upload endpoint or upload middleware is currently used.

Git is currently uninitialized. Initialize it only after reviewing `.gitignore` and confirming the environment files are excluded. No publishing, deployment, or database changes are performed by these instructions.
