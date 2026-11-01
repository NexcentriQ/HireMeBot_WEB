import type { Application } from './types'
import type { DashboardResponse } from './apiTypes'

/**
 * Dev-only mock dashboard payload. Shape is 1:1 with the backend
 * `GET /api/v1/student/applications` response (API.md), so swapping to live
 * mode is a factory switch, not a shape migration.
 *
 * The individual applications include `resumeUrl` / `coverLetterUrl` pointed
 * at the bundled sample documents in `public/samples/`. The backend GET does
 * not return these fields yet — the UI will pick them up transparently once
 * the backend adds them.
 */

const MOCK_RESUME = '/samples/sample-resume.pdf'
const MOCK_COVER_LETTER = '/samples/sample-cover-letter.pdf'
const MOCK_COVER_LETTER_DOCX = '/samples/sample-cover-letter.docx'

/**
 * Today's applications in mock mode. 25 entries so the UI exercises the
 * paginated path (page 1 = 20, page 2 = 5). All records share "today"
 * (2026-10-29) in the mock reporting zone (America/Chicago).
 */
const TODAYS_APPLICATIONS: Application[] = [
  {
    applicationId: 1000000125,
    companyName: 'Amazon',
    jobTitle: 'Software Development Engineer',
    jobLocation: 'Seattle, WA, USA',
    jobLink: 'https://www.amazon.jobs/en/jobs/1234567',
    jobSource: 'Amazon Careers',
    appliedAt: '2026-10-29T15:24:00-05:00',
    resumeUrl: MOCK_RESUME,
    coverLetterUrl: MOCK_COVER_LETTER
  },
  {
    applicationId: 1000000124,
    companyName: 'Microsoft',
    jobTitle: 'Backend Developer',
    jobLocation: 'Redmond, WA, USA',
    jobLink: 'https://careers.microsoft.com/us/en/job/microsoft-be-99887',
    jobSource: 'LinkedIn',
    appliedAt: '2026-10-29T14:10:00-05:00',
    resumeUrl: MOCK_RESUME,
    coverLetterUrl: MOCK_COVER_LETTER_DOCX
  },
  {
    applicationId: 1000000123,
    companyName: 'Google',
    jobTitle: 'Java Software Engineer',
    jobLocation: 'Mountain View, CA, USA',
    jobLink: 'https://careers.google.com/jobs/results/4455667788',
    jobSource: 'Company Careers',
    appliedAt: '2026-10-29T13:00:00-05:00',
    resumeUrl: MOCK_RESUME
  },
  {
    applicationId: 1000000122,
    companyName: 'Meta',
    jobTitle: 'Software Engineer',
    jobLocation: 'Menlo Park, CA, USA',
    jobLink: 'https://www.metacareers.com/jobs/90210',
    jobSource: 'LinkedIn',
    appliedAt: '2026-10-29T12:45:00-05:00',
    resumeUrl: MOCK_RESUME,
    coverLetterUrl: MOCK_COVER_LETTER
  },
  {
    applicationId: 1000000121,
    companyName: 'Apple',
    jobTitle: 'iOS Developer',
    jobLocation: 'Cupertino, CA, USA',
    jobLink: 'https://jobs.apple.com/en-us/details/200555123',
    jobSource: 'Company Careers',
    appliedAt: '2026-10-29T12:20:00-05:00',
    resumeUrl: MOCK_RESUME
  },
  {
    applicationId: 1000000120,
    companyName: 'Netflix',
    jobTitle: 'Backend Engineer',
    jobLocation: 'Los Gatos, CA, USA',
    jobLink: 'https://jobs.netflix.com/jobs/300999',
    jobSource: 'Referral',
    appliedAt: '2026-10-29T11:00:00-05:00',
    resumeUrl: MOCK_RESUME,
    coverLetterUrl: MOCK_COVER_LETTER
  },
  {
    applicationId: 1000000119,
    companyName: 'Stripe',
    jobTitle: 'Full-Stack Engineer',
    jobLocation: 'Remote, USA',
    jobLink: 'https://stripe.com/jobs/listing/full-stack-engineer/4120000',
    jobSource: 'Company Careers',
    appliedAt: '2026-10-29T10:30:00-05:00',
    resumeUrl: MOCK_RESUME
  },
  {
    applicationId: 1000000118,
    companyName: 'Salesforce',
    jobTitle: 'Platform Engineer',
    jobLocation: 'San Francisco, CA, USA',
    jobLink: 'https://salesforce.wd1.myworkdayjobs.com/External_Career/job/5566',
    jobSource: 'LinkedIn',
    appliedAt: '2026-10-29T10:00:00-05:00',
    resumeUrl: MOCK_RESUME,
    coverLetterUrl: MOCK_COVER_LETTER_DOCX
  },
  {
    applicationId: 1000000117,
    companyName: 'Oracle',
    jobTitle: 'Cloud Engineer',
    jobLocation: 'Austin, TX, USA',
    jobLink: 'https://careers.oracle.com/jobs/#en/sites/jobsearch/job/244410',
    jobSource: 'Company Careers',
    appliedAt: '2026-10-29T09:40:00-05:00',
    resumeUrl: MOCK_RESUME
  },
  {
    applicationId: 1000000116,
    companyName: 'IBM',
    jobTitle: 'AI Engineer',
    jobLocation: 'New York, NY, USA',
    jobLink: 'https://www.ibm.com/careers/us-en/job/ibm-ai-eng-77011',
    jobSource: 'Referral',
    appliedAt: '2026-10-29T09:20:00-05:00',
    resumeUrl: MOCK_RESUME,
    coverLetterUrl: MOCK_COVER_LETTER
  },
  // Entries 11..25 — generated so the paginator has a believable second page.
  ...generatedFillers()
]

function generatedFillers(): Application[] {
  const companies: Array<[string, string, string]> = [
    ['Spotify', 'Audio Platform Engineer', 'New York, NY, USA'],
    ['Shopify', 'Rails Engineer', 'Remote, USA'],
    ['Databricks', 'Data Platform Engineer', 'San Francisco, CA, USA'],
    ['Snowflake', 'Cloud Engineer', 'Bellevue, WA, USA'],
    ['Atlassian', 'Full-Stack Engineer', 'Austin, TX, USA'],
    ['Twilio', 'API Platform Engineer', 'Remote, USA'],
    ['Square', 'Backend Engineer', 'San Francisco, CA, USA'],
    ['Zoom', 'Video Infrastructure Engineer', 'San Jose, CA, USA'],
    ['Dropbox', 'Storage Engineer', 'Remote, USA'],
    ['Pinterest', 'ML Engineer', 'Palo Alto, CA, USA'],
    ['Reddit', 'Platform Engineer', 'Los Angeles, CA, USA'],
    ['Lyft', 'Mobile Platform Engineer', 'San Francisco, CA, USA'],
    ['Doordash', 'Logistics Engineer', 'San Francisco, CA, USA'],
    ['Pinterest', 'iOS Engineer', 'Palo Alto, CA, USA'],
    ['LinkedIn', 'Search Engineer', 'Sunnyvale, CA, USA']
  ]
  return companies.map((c, i) => ({
    applicationId: 1000000115 - i,
    companyName: c[0],
    jobTitle: c[1],
    jobLocation: c[2],
    jobLink: `https://careers.example.com/${c[0].toLowerCase()}/role/${i + 1}`,
    jobSource: i % 2 === 0 ? 'Company Careers' : 'LinkedIn',
    // Decreasing timestamps so order is deterministic.
    appliedAt: `2026-10-29T0${(9 - Math.min(i, 7)).toString().padStart(2, '0')}:${(45 - (i % 10)).toString().padStart(2, '0')}:00-05:00`,
    resumeUrl: MOCK_RESUME
  }))
}

function paginate(items: Application[], pageSize: number): Record<string, Application[]> {
  const out: Record<string, Application[]> = {}
  const total = Math.ceil(items.length / pageSize)
  for (let i = 0; i < total; i++) {
    out[String(i + 1)] = items.slice(i * pageSize, (i + 1) * pageSize)
  }
  return out
}

const PAGE_SIZE = 20
const TOTAL_TODAY = TODAYS_APPLICATIONS.length

export const MOCK_DASHBOARD: DashboardResponse = {
  studentId: 1000000002,
  date: '2026-10-29',
  totalApplications: TOTAL_TODAY,
  pageSize: PAGE_SIZE,
  totalPages: Math.ceil(TOTAL_TODAY / PAGE_SIZE),
  pages: paginate(TODAYS_APPLICATIONS, PAGE_SIZE),
  statistics: {
    asOfDate: '2026-10-29',
    timezone: 'America/Chicago',
    monthlyProgress: { month: '2026-10', applied: 820, target: 1100, remaining: 280, percentage: 75 },
    todayProgress: {
      date: '2026-10-29',
      applied: TOTAL_TODAY,
      target: 50,
      remaining: Math.max(0, 50 - TOTAL_TODAY),
      percentage: Math.round((TOTAL_TODAY / 50) * 100)
    },
    weeklyActivity: {
      weekStartDate: '2026-10-26',
      targetPerWeekday: 50,
      days: [
        { day: 'Mon', date: '2026-10-26', applications: 50 },
        { day: 'Tue', date: '2026-10-27', applications: 44 },
        { day: 'Wed', date: '2026-10-28', applications: 50 },
        { day: 'Thu', date: '2026-10-29', applications: TOTAL_TODAY },
        { day: 'Fri', date: '2026-10-30', applications: 0 }
      ]
    }
  }
}
