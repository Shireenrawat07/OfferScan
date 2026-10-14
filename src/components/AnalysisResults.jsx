function AnalysisResults({ results, assessment }) {
  const {
    findings = [],
    score = 0,
    level = "lower",
    recommendations = [],
    disclaimer,
  } = results;

  const status = {
    lower: {
      label: "Low",
      color: "text-emerald-700",
      background: "bg-emerald-50",
      bar: "bg-emerald-500",
    },
    moderate: {
      label: "Moderate",
      color: "text-amber-700",
      background: "bg-amber-50",
      bar: "bg-amber-500",
    },
    elevated: {
      label: "High",
      color: "text-red-700",
      background: "bg-red-50",
      bar: "bg-red-500",
    },
  }[level] || {
    label: "Low",
    color: "text-emerald-700",
    background: "bg-emerald-50",
    bar: "bg-emerald-500",
  };
  const overallStatus = {
    low: { color: "text-emerald-700", background: "bg-emerald-50", bar: "bg-emerald-500" },
    moderate: { color: "text-amber-700", background: "bg-amber-50", bar: "bg-amber-500" },
    high: { color: "text-orange-800", background: "bg-orange-50", bar: "bg-orange-600" },
    very_high: { color: "text-red-700", background: "bg-red-50", bar: "bg-red-500" },
  }[assessment?.level.id || "low"];
  const displayFindings = (assessment?.findings || findings)
    .filter((finding) => !finding.category?.includes("URL") && !finding.category?.includes("reputation") && !finding.category?.includes("VirusTotal"))
    .slice(0, 4);

  return (
    <section className="mt-8 space-y-5">
      {/* Combined risk score */}
      <div className="rounded-2xl border border-[#DCC8F2] bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Overall risk assessment</p>
            <h2 className="mt-1 text-3xl font-bold text-[#2E164B]">
              {assessment?.overallScore ?? Math.max(0, Math.min(100, score))}/100
            </h2>
          </div>

          <span
            className={`rounded-full px-3 py-2 text-sm font-semibold ${overallStatus.background} ${overallStatus.color}`}
          >
            {assessment?.level.label || status.label}
          </span>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${overallStatus.bar}`}
            style={{
              width: `${assessment?.overallScore ?? Math.max(0, Math.min(100, score))}%`,
            }}
          />
        </div>

        <p className="mt-3 text-xs leading-5 text-slate-500">
          Risk score based on message content, sender details, and URL security checks.
        </p>
      </div>

      {/* Warning signs */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-lg font-bold text-[#2E164B]">
          Important findings
        </h3>

        {displayFindings.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-slate-600">
            No clear warning signs were found in the supplied content. This does not verify the employer or offer.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {displayFindings.map((finding) => (
              <div key={finding.id} className="rounded-xl bg-[#F3ECFA] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-semibold text-[#2E164B]">
                    {finding.category}
                  </h4>

                  <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-600">
                    {finding.informational ? "Information" : `${finding.severity} concern`}
                  </span>
                </div>

                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {finding.reason}
                </p>

                {finding.evidence && (
                  <p className="mt-3 border-l-2 border-[#8B5CC7] pl-3 text-sm italic text-slate-600">
                    “{finding.evidence}”
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommended actions */}
      {recommendations.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="font-bold text-[#2E164B]">What should you do?</h3>

          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
            {recommendations.slice(0, 3).map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-center text-xs leading-5 text-slate-500">
        {disclaimer ||
          "OfferLens highlights potential risk signals. It cannot confirm fraud or guarantee that an offer is safe."}
      </p>
    </section>
  );
}

export default AnalysisResults;
