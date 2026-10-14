export const RISK_BANDS = [
  { id: "low", label: "Low", min: 0, max: 19 },
  { id: "moderate", label: "Moderate", min: 20, max: 44 },
  { id: "high", label: "High", min: 45, max: 69 },
  { id: "very_high", label: "Very High", min: 70, max: 100 },
];

export function riskBand(score) {
  return RISK_BANDS.find((band) => score >= band.min && score <= band.max) || RISK_BANDS[0];
}

export function combineWeightedEvidence(findings = []) {
  const groups = new Map();

  findings.forEach((finding, index) => {
    const weight = Math.max(0, Math.min(100, Number(finding.weight) || 0));
    if (!weight) return;
    const group = finding.scoringGroup || finding.id || `${finding.category || "evidence"}-${index}`;
    groups.set(group, Math.max(groups.get(group) || 0, weight));
  });

  // Independent evidence groups combine as weighted probabilities; overlapping
  // rules in the same group contribute only their strongest signal.
  const remainingRisk = [...groups.values()].reduce(
    (remaining, weight) => remaining * (1 - weight / 100),
    1,
  );
  return Math.max(0, Math.min(100, Math.round((1 - remainingRisk) * 100 + 1e-9)));
}
