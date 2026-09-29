// src/app/privacy/page.tsx
import { PageHeader } from '@/components/page-header'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Minato'
}

const STORAGE_ITEMS = [
  {
    name: 'next-auth.session-token',
    type: 'Cookie (essential)',
    purpose: 'Keeps you signed in to your account.',
    duration: 'Up to 30 days'
  },
  {
    name: 'next-auth.csrf-token',
    type: 'Cookie (essential)',
    purpose: 'Protects sign-in and sign-out from cross-site request forgery.',
    duration: 'Until you close your browser'
  },
  {
    name: 'next-auth.callback-url',
    type: 'Cookie (essential)',
    purpose: 'Returns you to the page you were on after signing in.',
    duration: 'Until you close your browser'
  },
  {
    name: 'theme',
    type: 'Local storage (preference)',
    purpose: 'Remembers your light or dark theme choice.',
    duration: 'Until you clear your browser data'
  },
  {
    name: 'sidebar-mode',
    type: 'Local storage (preference)',
    purpose: 'Remembers how you set the navigation sidebar to behave.',
    duration: 'Until you clear your browser data'
  }
]

export default function PrivacyPolicy() {
  return (
    <div className='max-w-3xl mx-auto space-y-8 py-8'>
      <PageHeader
        title='Privacy Policy'
        description='Last updated: September 2026'
      />

      <section className='space-y-3'>
        <h2 className='text-xl font-semibold'>1. Who we are</h2>
        <p className='text-muted-foreground'>
          Minato is operated by a health and safety consultancy acting as the
          data controller. We provide document management and compliance
          services to client businesses and their employees.
        </p>
        <p className='text-muted-foreground'>
          To contact us about your data, please reach out via your account
          administrator.
        </p>
      </section>

      <section className='space-y-3'>
        <h2 className='text-xl font-semibold'>2. What data we collect</h2>
        <p className='text-muted-foreground'>
          We collect the following personal data when you use Minato:
        </p>
        <ul className='list-disc list-inside space-y-1 text-muted-foreground'>
          <li>Name</li>
          <li>Email address (where provided; some workers have none)</li>
          <li>Job role and, where set, the line manager assigned to you</li>
          <li>Hashed password (for account holders)</li>
          <li>
            Employee number or date of birth, where an administrator has
            recorded one to confirm your identity at a shared sign-off kiosk
          </li>
          <li>
            Document completion records, including sign-off timestamps,
            comprehension question responses, form answers and your drawn
            signature
          </li>
          <li>
            The IP address and browser details (user agent) of the device used
            to sign a document, kept as part of the audit trail
          </li>
          <li>
            Files you upload as part of a document, including your own filled-in
            copy of a document where one is requested
          </li>
          <li>
            Activity logs recording actions taken within the Minato platform
          </li>
        </ul>
      </section>

      <section className='space-y-3'>
        <h2 className='text-xl font-semibold'>3. How we use your data</h2>
        <p className='text-muted-foreground'>We use personal data to:</p>
        <ul className='list-disc list-inside space-y-1 text-muted-foreground'>
          <li>Authenticate you and maintain your account</li>
          <li>
            Assign health and safety documents relevant to your role and send
            notifications about them
          </li>
          <li>Record your completion of assigned documents</li>
          <li>
            Generate audit trails of document sign-offs for compliance purposes
          </li>
          <li>
            Send reminder notifications for outstanding or overdue documents
          </li>
          <li>Allow password resets via email</li>
          <li>
            Confirm your identity when signing a document, by re-entering your
            password or, at a shared kiosk, your employee number or date of
            birth
          </li>
        </ul>
        <p className='text-muted-foreground'>
          Where a worker has no email address, notifications about their
          documents are sent to their line manager instead.
        </p>
        <p className='text-muted-foreground'>
          Our lawful basis is legitimate interest in health and safety
          compliance and, where required by law, legal obligation.
        </p>
      </section>

      <section className='space-y-3'>
        <h2 className='text-xl font-semibold'>4. Data retention</h2>
        <p className='text-muted-foreground'>
          Signed document completion records are retained for a minimum period
          in line with UK health and safety guidance (typically 3–5 years). The
          period is set by the consultancy and cannot be shortened by deleting a
          record early. Account data is retained for as long as your account is
          active. Activity logs are retained for audit purposes.
        </p>
        <p className='text-muted-foreground'>
          Password reset tokens expire after 1 hour and are deleted once used.
        </p>
      </section>

      <section className='space-y-3'>
        <h2 className='text-xl font-semibold'>5. Third-party services</h2>
        <p className='text-muted-foreground'>
          The Minato platform uses the following third-party infrastructure, all
          of which is covered by appropriate data processing agreements:
        </p>
        <ul className='list-disc list-inside space-y-1 text-muted-foreground'>
          <li>
            <strong>Microsoft Azure</strong> — file storage, audit logs,
            transactional email delivery and AI-assisted drafting of
            comprehension questions (Azure AI Foundry). Only document content is
            sent for drafting, not employee records
          </li>
          <li>
            <strong>Document conversion service</strong> — an Azure-hosted
            service that converts uploaded Word documents to PDF. Files are
            processed to produce the PDF and are not retained by the service
          </li>
          <li>
            <strong>Neon</strong> — hosted PostgreSQL database for user and
            document records
          </li>
        </ul>
        <p className='text-muted-foreground'>
          Data is stored within the UK or EEA where possible.
        </p>
      </section>

      <section className='space-y-3'>
        <h2 className='text-xl font-semibold'>6. Your rights (UK GDPR)</h2>
        <p className='text-muted-foreground'>
          Under UK GDPR you have the right to:
        </p>
        <ul className='list-disc list-inside space-y-1 text-muted-foreground'>
          <li>Access the personal data we hold about you</li>
          <li>Correct inaccurate data</li>
          <li>Request erasure (subject to our legal retention obligations)</li>
          <li>Object to processing based on legitimate interest</li>
          <li>Request restriction of processing</li>
          <li>Lodge a complaint with the ICO (ico.org.uk)</li>
        </ul>
        <p className='text-muted-foreground'>
          To exercise any of these rights, contact your account administrator.
        </p>
      </section>

      <section className='space-y-3'>
        <h2 className='text-xl font-semibold'>7. Cookies</h2>
        <p className='text-muted-foreground'>
          Minato only stores information on your device that is strictly
          necessary to provide the service you have asked for, or to remember
          your display preferences. For this reason we do not show a cookie
          consent banner. No analytics, advertising or third-party tracking
          cookies are used.
        </p>
        <div className='overflow-x-auto rounded-md border'>
          <table className='w-full text-left text-sm'>
            <thead className='border-b bg-muted/50'>
              <tr>
                <th className='p-3 font-medium'>Name</th>
                <th className='p-3 font-medium'>Type</th>
                <th className='p-3 font-medium'>Purpose</th>
                <th className='p-3 font-medium'>Duration</th>
              </tr>
            </thead>
            <tbody className='text-muted-foreground'>
              {STORAGE_ITEMS.map((item) => (
                <tr key={item.name} className='border-b last:border-0'>
                  <td className='p-3 align-top font-mono text-xs'>
                    {item.name}
                  </td>
                  <td className='p-3 align-top'>{item.type}</td>
                  <td className='p-3 align-top'>{item.purpose}</td>
                  <td className='p-3 align-top'>{item.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className='text-muted-foreground'>
          On secure (HTTPS) connections the cookie names carry a{' '}
          <code className='font-mono text-xs'>__Secure-</code> or{' '}
          <code className='font-mono text-xs'>__Host-</code> prefix. You can
          clear any of these from your browser settings; clearing the sign-in
          cookies will sign you out.
        </p>
      </section>

      <section className='space-y-3'>
        <h2 className='text-xl font-semibold'>8. Changes to this policy</h2>
        <p className='text-muted-foreground'>
          We may update this policy from time to time. Significant changes will
          be communicated via the Minato platform or by email where applicable.
        </p>
      </section>
    </div>
  )
}
