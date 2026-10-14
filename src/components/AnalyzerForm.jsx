
import { useRef, useState } from "react";
import analyzeOffer, { extractLinks } from "../utils/analyzeOffer";
import analyzeEmail from "../utils/analyzeEmail";
import analyzeLinks from "../utils/analyzeLinks";
import extractDocumentText from "../utils/extractDocumentText";
import AnalysisResults from "./AnalysisResults";
import { buildRiskAssessment, createSavedAnalysisPayload } from "../utils/riskAssessment";
import { useAuth } from "../context/useAuth";
import { apiRequest, API_BASE_URL } from "../utils/api";
const MAX_REPUTATION_URLS = 3;

function normalizeReputationUrl(value) {
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const parsedUrl = new URL(withProtocol);
    if (!["http:", "https:"].includes(parsedUrl.protocol) || !parsedUrl.hostname) {
      return null;
    }
    return parsedUrl.href;
  } catch {
    return null;
  }
}

const reputationStatusLabels = {
  malicious_detections: "Malicious detections reported",
  suspicious_detections: "Suspicious detections reported",
  no_threats_detected: "No threat detected in the available report",
  inconclusive: "The report has no usable verdicts",
  pending: "Analysis pending; no verdict yet",
};

function ExternalReputation({ url, result, onRetry }) {
  const reputation = result?.state === "success" ? result.data : null;

  return (
    <div className="mt-3 border-t border-purple-100 pt-3">
      <p className="text-xs font-semibold text-[#2E164B]">
        External reputation (VirusTotal)
      </p>

      {!url && (
        <p className="mt-1 text-xs text-slate-600">
          This text is not a valid HTTP or HTTPS URL, so it was not checked.
        </p>
      )}

      {url && result?.state === "loading" && (
        <p role="status" className="mt-1 text-xs text-[#593580]">
          Checking the existing reputation report...
        </p>
      )}

      {url && result?.state === "skipped" && (
        <p className="mt-1 text-xs text-slate-600">
          Not checked: only the first three unique URLs are sent per analysis.
        </p>
      )}

      {url && result?.state === "error" && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p role="alert" className="text-xs text-red-700">
            {result.message}
          </p>
          <button
            type="button"
            onClick={() => onRetry(url)}
            className="text-xs font-semibold text-[#593580] underline"
          >
            Retry
          </button>
        </div>
      )}

      {reputation && (
        <div className="mt-1">
          <p className="text-xs font-semibold text-slate-700">
            {reputation.available
              ? reputationStatusLabels[reputation.status] || "Reputation report available"
              : "No existing reputation report"}
          </p>
          <p className="mt-1 text-xs text-slate-600">{reputation.message}</p>
          {reputation.detections && (
            <p className="mt-1 text-xs text-slate-600">
              Malicious: {reputation.detections.malicious} / Suspicious: {reputation.detections.suspicious} / Harmless: {reputation.detections.harmless} / Undetected: {reputation.detections.undetected}
            </p>
          )}
          {reputation.disclaimer && (
            <p className="mt-1 text-xs text-slate-500">
              {reputation.disclaimer}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AnalyzerForm() {
  const { user } = useAuth();
  const [offerText, setOfferText] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [results, setResults] = useState(null);
  const [emailResults, setEmailResults] = useState(null);
  const [linkResults, setLinkResults] = useState([]);
  const [reputationResults, setReputationResults] = useState({});
  const reputationCache = useRef(new Map());
  const analysisRequestId = useRef(0);

  const [fileError, setFileError] = useState("");
  const [fileName, setFileName] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [saveState, setSaveState] = useState("");
  const linksForAssessment = linkResults.map((link) => {
    const url = normalizeReputationUrl(link.url);
    return { ...link, reputation: url ? reputationResults[url] : null };
  });
  const riskAssessment = buildRiskAssessment(results, emailResults, linksForAssessment);
  const reputationPending = linksForAssessment.some((link) => link.reputation?.state === "loading");

  const clearAnalysis = () => {
    analysisRequestId.current += 1;
    setResults(null);
    setEmailResults(null);
    setLinkResults([]);
    setReputationResults({});
    setSaveState("");
  };

  const getReputationResult = (url) => {
    const cachedRequest = reputationCache.current.get(url);
    if (cachedRequest) return cachedRequest;

    const request = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/links/check`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        let responseBody;
        try {
          responseBody = await response.json();
        } catch {
          throw new Error("The backend returned an unreadable response.");
        }
        if (!response.ok || !responseBody?.success || !responseBody?.data) {
          throw new Error(
            responseBody?.error?.message || "The reputation lookup failed."
          );
        }
        return { state: "success", data: responseBody.data };
      } catch (error) {
        return {
          state: "error",
          message: error.message || "Could not check this URL right now.",
        };
      }
    })();

    reputationCache.current.set(url, request);
    return request;
  };

  const checkExternalReputation = async (links, requestId) => {
    const uniqueUrls = [...new Set(links.map(normalizeReputationUrl).filter(Boolean))];
    const urlsToCheck = uniqueUrls.slice(0, MAX_REPUTATION_URLS);
    const nextResults = {};
    uniqueUrls.forEach((url, index) => {
      nextResults[url] =
        index < MAX_REPUTATION_URLS
          ? { state: "loading" }
          : { state: "skipped" };
    });
    setReputationResults(nextResults);

    await Promise.all(urlsToCheck.map(async (url) => {
      const result = await getReputationResult(url);
      if (analysisRequestId.current === requestId) {
        setReputationResults((current) => ({ ...current, [url]: result }));
      }
    }));
  };

  const retryExternalReputation = async (url) => {
    const requestId = analysisRequestId.current;
    reputationCache.current.delete(url);
    setReputationResults((current) => ({ ...current, [url]: { state: "loading" } }));
    const result = await getReputationResult(url);
    if (analysisRequestId.current === requestId) {
      setReputationResults((current) => ({ ...current, [url]: result }));
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];

    setFileError("");
    setFileName("");

    if (!file) return;

    const allowedExtensions = [
      ".txt",
      ".docx",
      ".pdf",
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
    ];

    const extension = file.name
      .slice(file.name.lastIndexOf("."))
      .toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      setFileError(
        "Please select a TXT, DOCX, PDF, PNG, JPG, JPEG, or WebP file."
      );
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFileError("The file must be smaller than 10 MB.");
      event.target.value = "";
      return;
    }

    setIsExtracting(true);
    setFileName(file.name);
    clearAnalysis();

    try {
      const extractedText = await extractDocumentText(file);
      setOfferText(extractedText);
    } catch (error) {
      setFileError(
        error.message || "We couldn't extract text from this file."
      );
      setFileName("");
      event.target.value = "";
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAnalyze = () => {
    setFileError("");

    if (!offerText.trim()) {
      setFileError(
        "Please paste a message or upload a document before analyzing."
      );
      return;
    }

    const links = extractLinks(offerText);
    const analysisResults = analyzeOffer(offerText);
    const analyzedLinks = analyzeLinks(links);

    setResults(analysisResults);
    setSaveState("");
    setLinkResults(analyzedLinks);
    const requestId = ++analysisRequestId.current;
    checkExternalReputation(links, requestId);

    if (senderEmail.trim()) {
      setEmailResults(analyzeEmail(senderEmail));
    } else {
      setEmailResults(null);
    }
  };

  const saveAnalysis = async () => {
    setSaveState("saving");
    try {
      const firstUrl = extractLinks(offerText).map(normalizeReputationUrl).find(Boolean);
      const hostname = firstUrl ? new URL(firstUrl).hostname : undefined;
      await apiRequest("/api/analysis", {
        method: "POST",
        body: JSON.stringify(createSavedAnalysisPayload(riskAssessment, results.recommendations, hostname)),
      });
      setSaveState("saved");
    } catch (error) {
      setSaveState(error.message);
    }
  };

  const handleClear = () => {
    setOfferText("");
    setSenderEmail("");
    setAppliedForRole("unsure");
    setClaimedOrganization("");
    setFileError("");
    setFileName("");
    clearAnalysis();

    const fileInput = document.getElementById("offerFile");

    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleTextChange = (event) => {
    setOfferText(event.target.value);
    setFileError("");
    setFileName("");
    clearAnalysis();
  };

  return (
    <section id="analyze" className="px-6 py-20 md:py-24">
      <div className="mx-auto max-w-3xl rounded-3xl border border-purple-100 bg-gradient-to-br from-[#F3ECFA] to-white px-6 py-12 shadow-sm md:px-12">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2E164B] text-2xl text-white shadow-lg shadow-purple-900/20">
          ✦
        </div>

        <h2 className="mt-6 text-center text-3xl font-bold text-[#2E164B]">
          Analyze a job offer
        </h2>

        <p className="mx-auto mt-4 max-w-lg text-center leading-7 text-slate-600">
          Paste a recruiter message or upload a document or screenshot to check
          for predefined warning signs.
        </p>

        <p className="mx-auto mt-3 max-w-2xl text-center text-xs leading-5 text-slate-500">
          When a message contains links, up to three unique URLs are sent to VirusTotal
          to look up existing reports. The full URL, including its path and query
          string, is shared with VirusTotal and may enter its shared dataset. Do not
          check private links or URLs containing access tokens.
        </p>

        <form
          className="mt-8"
          onSubmit={(event) => {
            event.preventDefault();

            if (!isExtracting) {
              handleAnalyze();
            }
          }}
        >
          {/* Sender email */}
          <div className="mb-6">
            <label
              htmlFor="senderEmail"
              className="mb-2 block font-semibold text-[#2E164B]"
            >
              Sender email address (optional)
            </label>

            <input
              id="senderEmail"
              type="email"
              value={senderEmail}
              onChange={(event) => {
                setSenderEmail(event.target.value);
                setEmailResults(null);
              }}
              placeholder="recruiter@company.com"
              style={{ caretColor: "#593580" }}
              className="w-full rounded-xl border border-purple-200 bg-white p-4 text-slate-900 placeholder:text-slate-400 focus:border-[#8B5CC7] focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>

          {/* File upload */}
          <div className="mb-6">
            <label
              htmlFor="offerFile"
              className="mb-2 block font-semibold text-[#2E164B]"
            >
              Upload a job document or screenshot
            </label>

            <div className="rounded-xl border-2 border-dashed border-purple-300 bg-white p-5">
              <input
                id="offerFile"
                type="file"
                accept=".txt,.docx,.pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleFileChange}
                disabled={isExtracting}
                className="block w-full cursor-pointer text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-[#DCC8F2] file:px-4 file:py-2 file:font-semibold file:text-[#2E164B] file:transition-colors file:duration-200 hover:file:bg-[#8B5CC7] hover:file:text-white disabled:opacity-60"
              />

              <p className="mt-3 text-xs leading-5 text-slate-500">
                Supported: TXT, DOCX, PDF, PNG, JPG, JPEG and WebP.
                Maximum file size: 10 MB.
              </p>

              {isExtracting && (
                <p
                  role="status"
                  className="mt-3 text-sm font-medium text-[#593580]"
                >
                  Extracting text from your file. Scanned PDFs and images may
                  take a little longer...
                </p>
              )}

              {fileName && !isExtracting && !fileError && (
                <p className="mt-3 break-all text-sm font-medium text-[#593580]">
                  Selected file: {fileName}
                </p>
              )}

              {fileError && (
                <p role="alert" className="mt-3 text-sm text-red-600">
                  {fileError}
                </p>
              )}
            </div>
          </div>

          {/* Job offer or recruiter message */}
          <div className="mb-2 flex items-center justify-between gap-3">
            <label
              htmlFor="offerText"
              className="block font-semibold text-[#2E164B]"
            >
              Job offer or recruiter message
            </label>

            {offerText && (
              <button
                type="button"
                onClick={() => {
                  setOfferText("");
                  setFileName("");
                  setFileError("");
                  clearAnalysis();

                  const fileInput = document.getElementById("offerFile");

                  if (fileInput) {
                    fileInput.value = "";
                  }
                }}
                className="text-sm font-semibold text-[#593580] hover:underline"
              >
                Clear text
              </button>
            )}
          </div>

          <textarea
            id="offerText"
            value={offerText}
            onChange={handleTextChange}
            placeholder="Paste a message here, or upload a file above..."
            rows={7}
            style={{ caretColor: "#593580" }}
            className="w-full rounded-xl border border-purple-200 bg-white p-4 text-slate-900 placeholder:text-slate-400 focus:border-[#8B5CC7] focus:outline-none focus:ring-2 focus:ring-purple-200"
          />

          {/* Action buttons */}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isExtracting}
              className="w-full rounded-xl bg-[#2E164B] px-6 py-4 font-semibold text-white shadow-lg shadow-purple-900/15 transition hover:bg-[#593580] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isExtracting ? "Extracting Text..." : "Analyze Offer →"}
            </button>

            {(offerText || senderEmail || fileName || results) && (
              <button
                type="button"
                onClick={handleClear}
                disabled={isExtracting}
                className="w-full rounded-xl border border-purple-200 bg-white px-6 py-4 font-semibold text-[#593580] transition hover:bg-[#F3ECFA] disabled:opacity-60 sm:w-auto"
              >
                Clear All
              </button>
            )}
          </div>
        </form>

        {/* Analysis report */}
        {results !== null && (
          <>
            {user ? (
              <div className="mt-6 rounded-xl border border-purple-100 bg-white p-4">
                <p className="text-xs text-slate-600">Saving stores the score, findings, and recommendations only. Your message and uploaded file are not stored.</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button type="button" disabled={saveState === "saving" || saveState === "saved" || reputationPending} onClick={saveAnalysis} className="rounded-lg bg-[#2E164B] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{reputationPending ? "Checking URLs…" : saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved to history" : "Save to history"}</button>
                  {saveState && saveState !== "saving" && saveState !== "saved" && <p role="alert" className="text-sm text-red-700">{saveState}</p>}
                  {saveState === "saved" && <a href="/history" className="text-sm font-semibold text-[#593580] underline">View history</a>}
                </div>
              </div>
            ) : (
              <p className="mt-5 text-center text-sm text-slate-600"><a href="/login" className="font-semibold text-[#593580] underline">Sign in</a> to save this result. Analysis works without an account.</p>
            )}
            <AnalysisResults results={results} assessment={riskAssessment} />

            {/* Compact Link Analysis */}
            {linkResults.length > 0 && (
              <div className="mt-5 rounded-xl border border-purple-100 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-[#2E164B]">
                    Link Analysis
                  </h3>

                  <span className="text-xs text-slate-500">
                    {linkResults.length} found
                  </span>
                </div>

                <div className="mt-3 space-y-3">
                  {linkResults.map((link, index) => {
                    const reputationUrl = normalizeReputationUrl(link.url);
                    const reputationResult = reputationUrl ? reputationResults[reputationUrl] : null;

                    return (
                    <div
                      key={`${link.url}-${index}`}
                      className="rounded-lg bg-[#F8F5FC] p-3"
                    >
                      <p className="break-all text-sm text-slate-700">
                        {link.url}
                      </p>

                      {link.findings.length > 0 && (
                        <p className="mt-1 text-xs text-slate-600">
                          {link.findings
                            .slice(0, 3)
                            .map((finding) => finding.reason)
                            .join(" · ")}
                        </p>
                      )}

                      <ExternalReputation
                        url={reputationUrl}
                        result={reputationResult}
                        onRetry={retryExternalReputation}
                      />
                    </div>
                    );
                  })}
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  These checks identify possible warning signs, not proof of
                  safety.
                </p>
              </div>
            )}

            {/* Sender email analysis */}
            {emailResults !== null && (
              <div className="mt-5 rounded-xl border border-purple-100 bg-white p-4">
                <h3 className="font-semibold text-[#2E164B]">
                  Sender Email Analysis
                </h3>

                <p className="mt-2 break-all text-sm text-slate-600">
                  {emailResults.email}
                </p>

                {emailResults.findings.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {emailResults.findings.map((finding, index) => (
                      <div
                        key={`${finding.title}-${index}`}
                        className="rounded-lg bg-[#F8F5FC] p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold text-[#2E164B]">
                            {finding.title}
                          </h4>

                          <span className="text-xs font-medium text-amber-800">
                            {finding.severity} severity
                          </span>
                        </div>

                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {finding.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">
                    No basic email-pattern warnings were detected. This does
                    not verify the sender's identity.
                  </p>
                )}

                {emailResults.disclaimer && (
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    {emailResults.disclaimer}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default AnalyzerForm;
