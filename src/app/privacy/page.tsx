// src/app/privacy/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Document Portal'
}

export default function PrivacyPolicy() {
  return (
    <div className='max-w-3xl mx-auto space-y-8 py-8'>
      <div>
        <h1 className='text-3xl font-bold'>Privacy Policy</h1>
        <p className='mt-2 text-muted-foreground'>Last updated: May 2026</p>
      </div>

      <section className='space-y-3'>
        <h2 className='text-xl font-semibold'>1. Who we are</h2>
        <p className='text-muted-foreground'>
          This Document Portal is operated by a health and safety consultancy
          acting as the data controller. We provide document management and
          compliance services to client businesses and their employees.
        </p>
        <p className='text-muted-foreground'>
          To contact us about your data, please reach out via your account
          administrator.
        </p>
      </section>

      <section className='space-y-3'>
        <h2 className='text-xl font-semibold'>2. What data we collect</h2>
        <p className='text-muted-foreground'>
          We collect the following personal data when you use this portal:
        </p>
        <ul className='list-disc list-inside space-y-1 text-muted-foreground'>
          <li>Name</li>
          <li>Email address (where provided)</li>
          <li>Job role</li>
          <li>Hashed password (for account holders)</li>
          <li>
            Document completion records, including sign-off timestamps and
            comprehension question responses
          </li>
          <li>Activity logs recording actions taken within the portal</li>
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
        </ul>
        <p className='text-muted-foreground'>
          Our lawful basis is legitimate interest in health and safety
          compliance and, where required by law, legal obligation.
        </p>
      </section>

      <section className='space-y-3'>
        <h2 className='text-xl font-semibold'>4. Data retention</h2>
        <p className='text-muted-foreground'>
          Signed document completion records are retained for a minimum of 3–5
          years in line with UK health and safety legislation. Account data is
          retained for as long as your account is active. Activity logs are
          retained for audit purposes.
        </p>
        <p className='text-muted-foreground'>
          Password reset tokens expire after 1 hour and are deleted once used.
        </p>
      </section>

      <section className='space-y-3'>
        <h2 className='text-xl font-semibold'>5. Third-party services</h2>
        <p className='text-muted-foreground'>
          This portal uses the following third-party infrastructure, all of
          which is covered by appropriate data processing agreements:
        </p>
        <ul className='list-disc list-inside space-y-1 text-muted-foreground'>
          <li>
            <strong>Microsoft Azure</strong> — file storage and transactional
            email delivery
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
          This portal uses a single session cookie to keep you signed in. No
          third-party tracking or advertising cookies are used.
        </p>
      </section>

      <section className='space-y-3'>
        <h2 className='text-xl font-semibold'>8. Changes to this policy</h2>
        <p className='text-muted-foreground'>
          We may update this policy from time to time. Significant changes will
          be communicated via the portal or by email where applicable.
        </p>
      </section>
    </div>
  )
}
