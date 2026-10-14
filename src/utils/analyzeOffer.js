import { combineWeightedEvidence, riskBand } from "./scoring.js";

const warningRules = [
  {
    id: "recruitment-fee",
    category: "Payment request",
    severity: "high",
    weight: 30,
    phrases: [
      "registration fee",
      "registration charges",
      "pay a registration",
      "application fee",
      "job confirmation fee",
      "verification fee",
      "upfront fee",
      "processing fee",
      "security deposit",
      "pay to apply",
      "payment to secure your job",
      "pay for your interview",
      "interview fee",
      "recruitment fee",
      "training fee",
      "training payment",
      "pay for training",
      "onboarding fee",
      "paid training",
      "certificate fee",
      "pay for your certificate",
      "refundable deposit",
    ],
    reason:
      "A recruitment-related payment or deposit is mentioned. Verify the request independently before paying.",
  },
  {
    id: "payment-pressure",
    category: "Urgent payment",
    severity: "high",
    weight: 25,
    phrases: [
      "pay immediately",
      "urgent payment",
      "pay today",
      "payment deadline",
      "pay now",
      "immediate payment",
      "limited time to pay",
    ],
    reason:
      "Urgent payment language may pressure you to act before verifying the opportunity.",
  },
  {
    id: "guaranteed-job",
    category: "Unrealistic promise",
    severity: "medium",
    weight: 25,
    phrases: [
      "guaranteed job",
      "100% job guarantee",
      "guaranteed placement",
      "job guaranteed",
      "guaranteed selection",
      "guaranteed employment",
      "guaranteed salary",
    ],
    reason:
      "A guaranteed employment or selection claim deserves scrutiny, especially when paired with payment requests.",
  },
  {
    id: "sensitive-information",
    category: "Sensitive information",
    severity: "high",
    weight: 30,
    phrases: [
      "share your password",
      "send your otp",
      "share your otp",
      "provide your otp",
      "enter your otp",
      "send your password",
      "provide your password",
      "share your banking credentials",
      "bank login credentials",
      "internet banking credentials",
      "banking credentials",
      "bank account number",
      "national id number",
      "government id",
      "bank account password",
      "card pin",
      "internet banking password",
      "bank account details",
      "card details",
      "share your aadhaar",
      "share your pan",
      "passport number",
      "government id number",
    ],
    reason:
      "The message may request highly sensitive authentication or financial information. Never share passwords, OTPs, or PINs.",
  },
  {
    id: "equipment-purchase",
    category: "Equipment purchase",
    severity: "high",
    weight: 25,
    phrases: [
      "purchase equipment from our vendor",
      "buy equipment from our vendor",
      "send money for your laptop",
      "pay for your work laptop",
      "purchase your work equipment",
      "buy your laptop",
      "pay for equipment",
    ],
    reason:
      "The message may ask you to pay for work equipment through a specified arrangement. Verify it directly with the employer.",
  },
  {
    id: "selection-claim",
    category: "Unsolicited selection claim",
    severity: "low",
    weight: 8,
    phrases: ["shortlisted", "selected for the", "selected as", "we are pleased to offer you a position", "offered you a position"],
    reason: "A selection claim should be verified through the employer's official contact details. Wording alone is not proof of fraud.",
  },
  {
    id: "urgent-registration",
    category: "Urgent registration deadline",
    severity: "medium",
    weight: 15,
    phrases: ["register immediately", "register today", "register now", "urgent registration deadline", "deadline is today", "registration closes today", "last day to register", "within 24 hours", "act quickly", "limited time", "respond immediately", "urgent deadline"],
    reason: "A short or urgent response deadline can pressure applicants to act before independently verifying the opportunity.",
  },
  {
    id: "dangerous-software",
    category: "Risky software instruction",
    severity: "high",
    weight: 35,
    phrases: ["install anydesk", "install teamviewer", "install remote access", "enable macros", "download the .exe", "install this software", "open the attached executable"],
    reason: "The message asks you to install software or open an executable in a way that could expose your device. Verify the instruction with the employer through an independent channel.",
  },
];

function parseReliableDates(text) {
  const dates = [];
  for (const match of text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) {
    const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
    if (date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() + 1 === Number(match[2]) && date.getUTCDate() === Number(match[3])) dates.push(date);
  }
  for (const match of text.matchAll(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/gi)) {
    const date = new Date(`${match[1]} ${match[2]}, ${match[3]} UTC`);
    if (!Number.isNaN(date.getTime())) dates.push(date);
  }
  return dates;
}

function normalizeText(text) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

// Split a message into sentences for more precise evidence.
function getSentences(text) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

// Check whether a matched phrase is being denied or discouraged.
function isNegated(sentence, phrase) {
  const normalizedSentence = normalizeText(sentence);
  const phraseIndex = normalizedSentence.indexOf(phrase);

  if (phraseIndex === -1) {
    return false;
  }

  const beforePhrase = normalizedSentence.slice(0, phraseIndex);
  const selectionPhrases = ["shortlisted", "selected for the", "selected as", "we are pleased to offer you a position", "offered you a position"];
  if (selectionPhrases.includes(phrase) && /\b(?:not|never|no longer|wasn't|weren't|isn't|aren't)\s*$/.test(beforePhrase)) {
    return true;
  }
  // Sensitive information: recognize direct safety instructions.
  const sensitivePhrases = [
    "share your password",
    "send your otp",
    "share your otp",
    "provide your otp",
    "enter your otp",
    "send your password",
    "provide your password",
    "share your banking credentials",
    "bank login credentials",
    "internet banking credentials",
    "banking credentials",
    "bank account number",
    "national id number",
    "government id",
    "bank account password",
    "card pin",
    "internet banking password",
    "bank account details",
    "card details",
    "share your aadhaar",
    "share your pan",
    "passport number",
    "government id number",
  ];

  if (sensitivePhrases.includes(phrase)) {
    const safetyInstruction =
      /\b(?:never|don't|do not|should not|shouldn't|must not|mustn't)\s+(?:ever\s+)?(?:share|send|provide|reveal|disclose|give)\b/i;

    if (safetyInstruction.test(beforePhrase)) {
      return true;
    }

    // Example: "You should not share your OTP."
    // The negation occurs immediately before "share your OTP".
    const immediateNegation =
      /\b(?:never|don't|do not|should not|shouldn't|must not|mustn't)\s+(?:ever\s+)?$/i;

    if (immediateNegation.test(beforePhrase)) {
      return true;
    }
  }

  const unsafeSoftwarePhrases = ["install anydesk", "install teamviewer", "install remote access", "enable macros", "download the .exe", "install this software", "open the attached executable"];
  if (unsafeSoftwarePhrases.includes(phrase) && /\b(?:never|don't|do not|should not|shouldn't|must not|mustn't|should never|must never)\s*(?:ever\s+)?$/i.test(beforePhrase)) return true;

  // Recruitment fees: detect statements denying a fee,
  // regardless of whether "fee" appears before or after the denial.
  const feePhrases = [
    "registration fee",
    "processing fee",
    "security deposit",
    "interview fee",
    "recruitment fee",
    "training fee",
    "refundable deposit",
  ];

  if (feePhrases.includes(phrase) || /(?:fee|deposit|charges|paid training|pay for your certificate)/.test(phrase)) {
    const deniesFee =
      /\b(?:we|our company|the company|the employer)\s+(?:do not|don't|does not|doesn't|never)\s+(?:charge|require|request|collect)\b/i;

    const explicitlyNoFee =
      /\b(?:no|zero)\s+(?:[\w-]+\s+){0,2}(?:fees?|charges?|deposit)\b/i;

    const noFeeRequired =
      /\b(?:there is|there are)\s+no\b.*\bfees?\b|\b(?:you are|you're)\s+not required to pay\b/i;

    if (
      deniesFee.test(normalizedSentence) ||
      explicitlyNoFee.test(normalizedSentence) ||
      noFeeRequired.test(normalizedSentence)
    ) {
      return true;
    }
  }

  // General direct negation immediately before a payment phrase.
  const paymentPhrases = [
    "pay to apply",
    "payment to secure your job",
    "pay for your interview",
    "pay immediately",
    "urgent payment",
    "pay today",
    "pay a registration",
    "pay for your certificate",
    "pay for equipment",
    "buy your laptop",
    "payment deadline",
    "pay now",
    "immediate payment",
    "limited time to pay",
    "send money for your laptop",
    "pay for your work laptop",
  ];

  if (paymentPhrases.includes(phrase)) {
    const immediateNegation =
      /\b(?:not|never|don't|do not|should not|shouldn't|must not|mustn't)\s+(?:(?:have|need) to\s+|(?:be )?required to\s+)?$/i;

    if (immediateNegation.test(beforePhrase)) {
      return true;
    }
  }

  // A positive matched phrase must not be dismissed just because
  // a different part of the sentence contains a negation.
  return false;
}

function analyzeOffer(offerText) {
  const originalText =
    typeof offerText === "string" ? offerText.trim() : "";

  const normalizedText = normalizeText(originalText);

  if (!normalizedText) {
    return {
      findings: [],
      score: 0,
      level: "lower",
      recommendations: [
        "Paste a job offer or recruiter message to analyze it.",
      ],
    };
  }

  const findings = [];
  const sentences = getSentences(originalText);

  // Check every rule against each sentence.
  for (const rule of warningRules) {
    const matchedPhrases = new Set();
    const evidenceSentences = new Set();

    for (const phrase of rule.phrases) {
      for (const sentence of sentences) {
        const normalizedSentence = normalizeText(sentence);

        if (!normalizedSentence.includes(phrase)) {
          continue;
        }

        if (isNegated(sentence, phrase)) {
          continue;
        }

        matchedPhrases.add(phrase);
        evidenceSentences.add(sentence);
      }
    }

    // Each category creates only one finding,
    // even if multiple phrases from that category match.
    if (matchedPhrases.size > 0) {
      const phrases = [...matchedPhrases];

      findings.push({
        id: rule.id,
        category: rule.category,
        severity: rule.severity,
        weight: rule.weight,
        scoringGroup: ["recruitment-fee", "payment-pressure", "equipment-purchase"].includes(rule.id) ? "payment-demand" : ["selection-claim", "guaranteed-job"].includes(rule.id) ? "employment-claim" : rule.id === "urgent-registration" ? "deadline-pressure" : rule.id,
        matchedPhrase: phrases[0],
        matchedPhrases: phrases,
        evidence: [...evidenceSentences].join(" "),
        reason: rule.reason,
      });
    }
  }

  const deadlineContext = /\b(deadline|expires?|submit by|apply by|register by|application closes|valid until)\b/i;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const expiredDeadline = sentences.find((sentence) => deadlineContext.test(sentence) && parseReliableDates(sentence).some((date) => date.getTime() < today.getTime()));
  if (expiredDeadline) findings.push({
    id: "expired-deadline",
    category: "Expired deadline",
    severity: "high",
    weight: 25,
    scoringGroup: "deadline-pressure",
    matchedPhrase: "expired deadline",
    matchedPhrases: ["deadline", "past date"],
    evidence: expiredDeadline,
    reason: "A stated application or offer deadline appears to have passed. Confirm the date and opportunity through the employer's official channel.",
  });

  const score = combineWeightedEvidence(findings);
  const band = riskBand(score);
  const level = band.id === "low" ? "lower" : band.id === "very_high" ? "very-high" : band.id === "high" ? "elevated" : "moderate";

  return {
    findings,
    score,
    level,
    recommendations: [
      "Confirm the vacancy on the employer's official careers website.",
      "Verify the recruiter using contact information obtained independently.",
      "Do not pay recruitment fees or share passwords, OTPs, or PINs.",
      "Verify equipment-purchase instructions directly with the employer.",
      "Treat this report as a set of risk signals, not proof of fraud.",
    ],
  };
}

// Extract unique HTTP, HTTPS, and www links.
function extractLinks(text) {
  if (typeof text !== "string" || !text.trim()) {
    return [];
  }

  const urlPattern = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
  const matches = text.match(urlPattern) || [];

  return [
    ...new Set(
      matches.map((url) =>
        url.replace(/[),.!?;:]+$/, "")
      )
    ),
  ];
}

export { extractLinks };
export default analyzeOffer;
