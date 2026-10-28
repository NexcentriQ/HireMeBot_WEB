import type { Application, DashboardSummary } from './types'

/**
 * Representative sample of recent applications aligned with the backend
 * `GET /api/v1/student/applications` response shape (see API.md). This is
 * NOT the full ~820-record monthly dataset; it is the small subset the UI
 * actually renders. The aggregate dashboard numbers (820 submitted, 126 in
 * review, etc.) are provided separately by `MOCK_DASHBOARD_SUMMARY` and
 * should be treated as sample preview values.
 *
 * `resumeUrl` and `coverLetterUrl` are sample S3-style URLs so the student
 * application-view can demonstrate document access. Replace with real
 * pre-signed URLs once the backend starts returning them.
 */

// Sample documents are generated at install/build time by
// scripts/generate-sample-docs.mjs into public/samples/. Vite serves /public
// at the site root, so these relative URLs resolve to real downloadable
// files during dev and in the production build. Replace with real pre-signed
// S3 URLs once the backend returns them.
const MOCK_RESUME = '/samples/sample-resume.pdf'
const MOCK_COVER_LETTER = '/samples/sample-cover-letter.pdf'
const MOCK_COVER_LETTER_DOCX = '/samples/sample-cover-letter.docx'

export const MOCK_APPLICATIONS: Application[] = [
  {
    applicationId: 1000000025,
    companyName: 'Amazon',
    jobTitle: 'Software Development Engineer',
    jobLocation: 'Seattle, WA, USA',
    jobLink: 'https://www.amazon.jobs/en/jobs/1234567',
    jobSource: 'Amazon Careers',
    appliedAt: '2026-10-15T15:24:00Z',
    resumeUrl: MOCK_RESUME,
    coverLetterUrl: MOCK_COVER_LETTER
  },
  {
    applicationId: 1000000024,
    companyName: 'Microsoft',
    jobTitle: 'Backend Developer',
    jobLocation: 'Redmond, WA, USA',
    jobLink: 'https://careers.microsoft.com/us/en/job/microsoft-be-99887',
    jobSource: 'LinkedIn',
    appliedAt: '2026-10-14T14:10:00Z',
    resumeUrl: MOCK_RESUME,
    coverLetterUrl: MOCK_COVER_LETTER_DOCX
  },
  {
    applicationId: 1000000023,
    companyName: 'Google',
    jobTitle: 'Java Software Engineer',
    jobLocation: 'Mountain View, CA, USA',
    jobLink: 'https://careers.google.com/jobs/results/4455667788',
    jobSource: 'Company Careers',
    appliedAt: '2026-10-14T13:00:00Z',
    resumeUrl: MOCK_RESUME
  },
  {
    applicationId: 1000000022,
    companyName: 'Meta',
    jobTitle: 'Software Engineer',
    jobLocation: 'Menlo Park, CA, USA',
    jobLink: 'https://www.metacareers.com/jobs/90210',
    jobSource: 'LinkedIn',
    appliedAt: '2026-10-13T18:45:00Z',
    resumeUrl: MOCK_RESUME,
    coverLetterUrl: MOCK_COVER_LETTER
  },
  {
    applicationId: 1000000021,
    companyName: 'Apple',
    jobTitle: 'iOS Developer',
    jobLocation: 'Cupertino, CA, USA',
    jobLink: 'https://jobs.apple.com/en-us/details/200555123',
    jobSource: 'Company Careers',
    appliedAt: '2026-10-12T20:20:00Z',
    resumeUrl: MOCK_RESUME
  },
  {
    applicationId: 1000000020,
    companyName: 'Netflix',
    jobTitle: 'Backend Engineer',
    jobLocation: 'Los Gatos, CA, USA',
    jobLink: 'https://jobs.netflix.com/jobs/300999',
    jobSource: 'Referral',
    appliedAt: '2026-10-12T16:00:00Z',
    resumeUrl: MOCK_RESUME,
    coverLetterUrl: MOCK_COVER_LETTER
  },
  {
    applicationId: 1000000019,
    companyName: 'Stripe',
    jobTitle: 'Full-Stack Engineer',
    jobLocation: 'Remote, USA',
    jobLink: 'https://stripe.com/jobs/listing/full-stack-engineer/4120000',
    jobSource: 'Company Careers',
    appliedAt: '2026-10-10T14:30:00Z',
    resumeUrl: MOCK_RESUME
  },
  {
    applicationId: 1000000018,
    companyName: 'Salesforce',
    jobTitle: 'Platform Engineer',
    jobLocation: 'San Francisco, CA, USA',
    jobLink: 'https://salesforce.wd1.myworkdayjobs.com/External_Career/job/5566',
    jobSource: 'LinkedIn',
    appliedAt: '2026-10-02T19:00:00Z',
    resumeUrl: MOCK_RESUME,
    coverLetterUrl: MOCK_COVER_LETTER_DOCX
  },
  {
    applicationId: 1000000017,
    companyName: 'Oracle',
    jobTitle: 'Cloud Engineer',
    jobLocation: 'Austin, TX, USA',
    jobLink: 'https://careers.oracle.com/jobs/#en/sites/jobsearch/job/244410',
    jobSource: 'Company Careers',
    appliedAt: '2026-10-09T15:00:00Z',
    resumeUrl: MOCK_RESUME
  },
  {
    applicationId: 1000000016,
    companyName: 'IBM',
    jobTitle: 'AI Engineer',
    jobLocation: 'New York, NY, USA',
    jobLink: 'https://www.ibm.com/careers/us-en/job/ibm-ai-eng-77011',
    jobSource: 'Referral',
    appliedAt: '2026-10-07T14:00:00Z',
    resumeUrl: MOCK_RESUME,
    coverLetterUrl: MOCK_COVER_LETTER
  }
]

/**
 * Aggregate dashboard numbers. These are *sample* placeholders for UI
 * reference and are intentionally larger than the sample list above. The
 * backend will provide these from the full dataset once the real
 * StudentLambda APIs are wired up.
 *
 * Preview metrics (In Review, Interviews, Offers, Rejected) are fixed
 * display-only values per the V1 spec.
 */
export const MOCK_DASHBOARD_SUMMARY: DashboardSummary = {
  month: { year: 2026, monthIndex: 9 }, // October 2026
  monthlySubmitted: 820,
  todaySubmitted: 35,
  previews: {
    inReview: 126,
    interviews: 8,
    offers: 2,
    rejected: 54
  },
  weekly: [
    { day: 'Mon', submitted: 50 },
    { day: 'Tue', submitted: 44 },
    { day: 'Wed', submitted: 50 },
    { day: 'Thu', submitted: 38 },
    { day: 'Fri', submitted: 47 }
  ]
}
