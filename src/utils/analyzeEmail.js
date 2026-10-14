
const freeEmailProviders = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
]

function analyzeEmail(email) {
  const normalizedEmail = email.trim().toLowerCase()
  const findings = []

  // Check 1: Is the email address formatted correctly?
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailPattern.test(normalizedEmail)) {
    return {
      email: normalizedEmail,
      status: 'invalid',
      findings: [
        {
          severity: 'medium',
          weight: 10,
          title: 'Invalid email format',
          reason:
            'This address does not match the expected email format. Check for typing mistakes.',
        },
      ],
      disclaimer:
        'Email format validation does not verify whether an address exists.',
    }
  }

  const domain = normalizedEmail.split('@')[1]
  const isFreeProvider = freeEmailProviders.includes(domain)

  // Check 2: Does the address use a free email provider?
  if (isFreeProvider) {
    findings.push({
      severity: 'low',
      weight: 5,
      title: 'Free email provider',
      reason:
        'The sender uses a public email provider rather than a custom company domain. This is common for individuals and small businesses, so it is not proof of fraud.',
    })
  }

  // Check 3: Does the domain use unusual characters?
  if (domain.startsWith('xn--') || domain.includes('.xn--')) {
    findings.push({
      severity: 'medium',
      weight: 12,
      title: 'Internationalized domain detected',
      reason:
        'This domain uses encoded international characters. Check the displayed domain carefully for possible lookalike characters.',
    })
  }

  // Check 4: Does the domain resemble a basic typo pattern?
  const suspiciousPatterns = [
    /-{2,}/,
    /\d{4,}/,
    /\.{2,}/,
  ]

  if (suspiciousPatterns.some((pattern) => pattern.test(domain))) {
    findings.push({
      severity: 'low',
      weight: 8,
      title: 'Unusual domain pattern',
      reason:
        'The domain contains a pattern that may deserve closer inspection. Legitimate domains can also contain numbers or hyphens.',
    })
  }

  return {
    email: normalizedEmail,
    domain,
    status: findings.length > 0 ? 'needs-review' : 'no-basic-warning',
    findings,
    disclaimer:
      'These are preliminary format and pattern checks only. They do not confirm that the sender is genuine, that the mailbox exists, or that the domain belongs to the claimed employer.',
  }
}

export default analyzeEmail
