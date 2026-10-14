const test = require("node:test");
const assert = require("node:assert/strict");
const { checkUrlReputation, VirusTotalError } = require("../services/virusTotal.service");

function response(status, body) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

async function withApiKey(t, callback) {
  const previousKey = process.env.VIRUSTOTAL_API_KEY;
  process.env.VIRUSTOTAL_API_KEY = "unit-test-only-key";
  try { await callback(); }
  finally {
    if (previousKey === undefined) delete process.env.VIRUSTOTAL_API_KEY;
    else process.env.VIRUSTOTAL_API_KEY = previousKey;
  }
}

test("VirusTotal existing report lookup is GET-only and returns malicious detections", async (t) => {
  await withApiKey(t, async () => {
    let request;
    t.mock.method(global, "fetch", async (url, options) => {
      request = { url, options };
      return response(200, { data: { attributes: { last_analysis_stats: { malicious: 3, suspicious: 1, harmless: 8, undetected: 2 } } } });
    });
    const result = await checkUrlReputation("https://example.test/apply");
    assert.equal(request.options.method, "GET");
    assert.ok(request.url.startsWith("https://www.virustotal.com/api/v3/urls/"));
    assert.equal(result.status, "malicious_detections");
    assert.equal(result.detections.malicious, 3);
  });
});

test("VirusTotal suspicious and clean reports keep distinct statuses", async (t) => {
  await withApiKey(t, async () => {
    const reports = [
      { data: { attributes: { last_analysis_stats: { malicious: 0, suspicious: 2, harmless: 6, undetected: 1 } } } },
      { data: { attributes: { last_analysis_stats: { malicious: 0, suspicious: 0, harmless: 6, undetected: 1 } } } },
    ];
    t.mock.method(global, "fetch", async () => response(200, reports.shift()));
    assert.equal((await checkUrlReputation("https://example.test/a")).status, "suspicious_detections");
    assert.equal((await checkUrlReputation("https://example.test/b")).status, "no_threats_detected");
  });
});

test("VirusTotal missing report is no_data, not clean", async (t) => {
  await withApiKey(t, async () => {
    t.mock.method(global, "fetch", async () => response(404, {}));
    const result = await checkUrlReputation("https://example.test/no-report");
    assert.equal(result.available, false);
    assert.equal(result.status, "no_data");
    assert.match(result.disclaimer, /does not mean/i);
  });
});

test("explicit VirusTotal pending status is not converted into a clean verdict", async (t) => {
  await withApiKey(t, async () => {
    t.mock.method(global, "fetch", async () => response(200, { data: { attributes: { status: "queued" } } }));
    const result = await checkUrlReputation("https://example.test/pending");
    assert.equal(result.status, "pending");
    assert.match(result.disclaimer, /not a safety verdict/i);
  });
});

test("VirusTotal rate limits remain explicit errors without a verdict", async (t) => {
  await withApiKey(t, async () => {
    t.mock.method(global, "fetch", async () => response(429, {}));
    await assert.rejects(checkUrlReputation("https://example.test/rate-limit"), (error) => {
      assert.ok(error instanceof VirusTotalError);
      assert.equal(error.code, "VIRUSTOTAL_RATE_LIMITED");
      return true;
    });
  });
});

test("VirusTotal server errors remain failures and do not create a report", async (t) => {
  await withApiKey(t, async () => {
    t.mock.method(global, "fetch", async () => response(503, {}));
    await assert.rejects(checkUrlReputation("https://example.test/api-error"), (error) => {
      assert.ok(error instanceof VirusTotalError);
      assert.equal(error.code, "VIRUSTOTAL_REQUEST_FAILED");
      return true;
    });
  });
});
