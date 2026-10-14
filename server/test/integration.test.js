const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validateBody } = require("../controllers/analysis.controller");
const { checkUrlReputation, VirusTotalError } = require("../services/virusTotal.service");
const User = require("../models/User");
const Analysis = require("../models/Analysis");
const { register, login, logout } = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/requireAuth");
const { errorHandler } = require("../middleware/errorHandler");
const { createAnalysis, listAnalyses, getAnalysis, deleteAnalysis } = require("../controllers/analysis.controller");

function mockResponse() {
  return {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    cookie(name, token, options) { this.cookieValue = { name, token, options }; return this; },
    clearCookie(name, options) { this.clearedCookie = { name, options }; return this; },
  };
}

test("password hashing does not retain the plain-text password", async () => {
  const password = "local-test-password";
  const hash = await bcrypt.hash(password, 4);
  assert.notEqual(hash, password);
  assert.equal(await bcrypt.compare(password, hash), true);
  assert.equal(await bcrypt.compare("wrong-password", hash), false);
});

test("history accepts only analyzer result fields and bounded values", () => {
  assert.equal(validateBody({
    type: "offer", score: 20, level: "moderate", findings: [{
      category: "Payment request", severity: "high", reason: "A payment request was detected.", evidence: "private message text",
    }], recommendations: ["Verify independently."], metadata: { hostname: "example.com" },
  }), null);
  assert.equal(validateBody({ type: "offer", score: 101, level: "elevated", findings: [], recommendations: [] }), "Analysis score must be between 0 and 100.");
  assert.equal(validateBody({ type: "offer", score: 0, level: "lower", findings: [{ category: "user-provided private text", severity: "low", reason: "text" }], recommendations: [] }), "Analysis findings are invalid.");
  assert.equal(validateBody({ type: "offer", score: 0, level: "lower", findings: [], recommendations: [], recruiterMessage: "do not save" }), "Unexpected analysis fields.");
  assert.equal(validateBody({
    type: "offer", score: 80, level: "elevated",
    findings: [{ category: "Malicious URL reputation", severity: "high", reason: "VirusTotal reports malicious detections." }],
    recommendations: [],
  }), null);
  assert.equal(validateBody({
    type: "offer", score: 82, level: "very-high",
    findings: [{ category: "Risky software instruction", severity: "high", weight: 35, reason: "Verify the software request independently." }],
    recommendations: [],
  }), null);
  assert.equal(validateBody({
    type: "offer", score: 0, level: "lower",
    findings: [{ category: "No VirusTotal report available", severity: "low", weight: 0, reason: "No report is available; this does not mean the URL is safe." }],
    recommendations: [],
  }), null);
});

test("VirusTotal lookup reports missing configuration without making a request", async () => {
  const previousKey = process.env.VIRUSTOTAL_API_KEY;
  delete process.env.VIRUSTOTAL_API_KEY;
  try {
    await assert.rejects(checkUrlReputation("https://example.com"), (error) => {
      assert.ok(error instanceof VirusTotalError);
      assert.equal(error.code, "VIRUSTOTAL_NOT_CONFIGURED");
      return true;
    });
  } finally {
    if (previousKey === undefined) delete process.env.VIRUSTOTAL_API_KEY;
    else process.env.VIRUSTOTAL_API_KEY = previousKey;
  }
});

test("registration hashes the password and returns only safe user fields", async (t) => {
  const user = { id: "unit-test-user", name: "Test User", email: "test@example.com", tokenVersion: 0 };
  t.mock.method(User, "exists", async () => null);
  let createInput;
  t.mock.method(User, "create", async (input) => { createInput = input; return user; });
  t.mock.method(jwt, "sign", () => "test-session-token");
  const res = mockResponse();

  await register({ body: { name: "Test User", email: "TEST@example.com", password: "safe-password" } }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 201);
  assert.equal(await bcrypt.compare("safe-password", createInput.passwordHash), true);
  assert.equal("passwordHash" in res.body.data.user, false);
  assert.equal(res.cookieValue.options.httpOnly, true);
});

test("duplicate registration and invalid login are rejected safely", async (t) => {
  t.mock.method(User, "exists", async () => ({ _id: "existing" }));
  const duplicate = mockResponse();
  await register({ body: { name: "Test User", email: "taken@example.com", password: "safe-password" } }, duplicate, (error) => { throw error; });
  assert.equal(duplicate.statusCode, 409);

  t.mock.method(User, "findOne", () => ({ select: async () => null }));
  const invalid = mockResponse();
  await login({ body: { email: "unknown@example.com", password: "wrong-password" } }, invalid, (error) => { throw error; });
  assert.equal(invalid.statusCode, 401);
  assert.equal(invalid.body.error.code, "INVALID_CREDENTIALS");
});

test("registration database failures return a reference and log no raw error details", async (t) => {
  t.mock.method(User, "exists", async () => null);
  t.mock.method(bcrypt, "hash", async () => "test-hash-placeholder");
  const dbError = new Error("Sensitive connection details must not be logged.");
  dbError.name = "MongoServerSelectionError";
  dbError.code = "ECONNREFUSED";
  t.mock.method(User, "create", async () => { throw dbError; });

  let logLine = "";
  t.mock.method(console, "error", (line) => { logLine = line; });
  const req = { method: "POST", path: "/api/auth/register", requestId: "safe-test-reference" };
  const res = mockResponse();
  await register({ body: { name: "Test User", email: "test@example.com", password: "safe-password" } }, res, (error) => errorHandler(error, req, res, () => {}));

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error.code, "DATABASE_UNAVAILABLE");
  assert.equal(res.body.error.requestId, "safe-test-reference");
  assert.equal(JSON.stringify(res.body).includes("Sensitive connection details"), false);
  assert.equal(logLine.includes("Sensitive connection details"), false);
  assert.equal(logLine.includes("safe-password"), false);
  assert.equal(logLine.includes("test@example.com"), false);
});

test("valid login returns a signed browser cookie without returning the hash", async (t) => {
  const passwordHash = await bcrypt.hash("safe-password", 4);
  const user = { id: "unit-test-user", name: "Test User", email: "test@example.com", tokenVersion: 0, passwordHash };
  t.mock.method(User, "findOne", () => ({ select: async () => user }));
  t.mock.method(jwt, "sign", () => "test-session-token");
  const res = mockResponse();

  await login({ body: { email: "TEST@example.com", password: "safe-password" } }, res, (error) => { throw error; });

  assert.equal(res.statusCode, undefined);
  assert.equal(res.cookieValue.options.httpOnly, true);
  assert.equal(res.body.data.user.email, "test@example.com");
  assert.equal("passwordHash" in res.body.data.user, false);
});

test("authentication guard rejects requests without a session cookie", async () => {
  const res = mockResponse();
  await requireAuth({ cookies: {} }, res, () => assert.fail("Unauthenticated request should not continue."));
  assert.equal(res.statusCode, 401);
});

test("analysis save removes quoted evidence and list is scoped to the user", async (t) => {
  let saved;
  t.mock.method(Analysis, "create", async (input) => { saved = input; return { id: "saved-id", ...input }; });
  const body = { type: "offer", score: 20, level: "moderate", findings: [{ category: "Payment request", severity: "high", reason: "Review a request.", evidence: "private recruiter message" }], recommendations: [] };
  const createRes = mockResponse();
  await createAnalysis({ body, user: { id: "owner-id" } }, createRes, (error) => { throw error; });
  assert.equal(createRes.statusCode, 201);
  assert.equal(saved.user, "owner-id");
  assert.equal("evidence" in saved.findings[0], false);

  let queriedFilter;
  const query = {
    sort() { return this; }, skip() { return this; }, limit() { return this; },
    lean: async () => [],
  };
  t.mock.method(Analysis, "find", (filter) => { queriedFilter = filter; return query; });
  t.mock.method(Analysis, "countDocuments", async (filter) => { assert.deepEqual(filter, { user: "owner-id" }); return 0; });
  const listRes = mockResponse();
  await listAnalyses({ query: {}, user: { id: "owner-id" } }, listRes, (error) => { throw error; });
  assert.deepEqual(queriedFilter, { user: "owner-id" });
});

test("history detail and delete constrain database lookups to the owner", async (t) => {
  const id = "65a1f0a7be3c2a0e1d4c5b6a";
  let filter;
  t.mock.method(Analysis, "findOne", (query) => {
    filter = query;
    return { lean: async () => ({ _id: id, user: "owner-id", score: 5 }) };
  });
  const detailRes = mockResponse();
  await getAnalysis({ params: { id }, user: { id: "owner-id" } }, detailRes, (error) => { throw error; });
  assert.deepEqual(filter, { _id: id, user: "owner-id" });
  assert.equal(detailRes.body.data.analysis.score, 5);

  let deleteFilter;
  t.mock.method(Analysis, "findOneAndDelete", async (query) => { deleteFilter = query; return { _id: id }; });
  const deleteRes = mockResponse();
  await deleteAnalysis({ params: { id }, user: { id: "owner-id" } }, deleteRes, (error) => { throw error; });
  assert.deepEqual(deleteFilter, { _id: id, user: "owner-id" });
  assert.equal(deleteRes.body.success, true);
});

test("logout increments the session version and clears the cookie", async () => {
  let update;
  const req = { user: { updateOne: async (change) => { update = change; } } };
  const res = mockResponse();
  await logout(req, res, (error) => { throw error; });
  assert.deepEqual(update, { $inc: { tokenVersion: 1 } });
  assert.equal(res.clearedCookie.name, "offerlens_session");
});
