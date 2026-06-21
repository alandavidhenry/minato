// src/lib/pdf/user-manual-pdf.tsx
// Server-side only — used in API routes via renderToBuffer.
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer
} from '@react-pdf/renderer'

const BLUE = '#2563EB'
const DARK = '#111827'
const MID = '#374151'
const MUTED = '#6B7280'
const BORDER = '#E5E7EB'
const BG_LIGHT = '#F3F4F6'
const BG_BLUE = '#EFF6FF'
const WHITE = '#FFFFFF'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: DARK,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48
  },

  // Cover page
  coverPage: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: WHITE,
    backgroundColor: BLUE,
    padding: 0
  },
  coverTop: {
    backgroundColor: BLUE,
    padding: 60,
    flex: 1,
    justifyContent: 'center'
  },
  coverTag: {
    fontSize: 9,
    color: '#BFDBFE',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 16
  },
  coverTitle: {
    fontSize: 32,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
    lineHeight: 1.2,
    marginBottom: 12
  },
  coverSubtitle: {
    fontSize: 14,
    color: '#BFDBFE',
    marginBottom: 40
  },
  coverDivider: {
    width: 48,
    height: 3,
    backgroundColor: '#93C5FD',
    marginBottom: 40
  },
  coverMeta: {
    fontSize: 9,
    color: '#93C5FD'
  },
  coverBottom: {
    backgroundColor: '#1D4ED8',
    padding: 24,
    paddingHorizontal: 60
  },
  coverNote: {
    fontSize: 9,
    color: '#BFDBFE'
  },

  // Section header band
  sectionBand: {
    backgroundColor: BLUE,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
    borderRadius: 4
  },
  sectionTag: {
    fontSize: 8,
    color: '#BFDBFE',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 3
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: WHITE
  },

  // Chapter headings
  chapterHeading: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: BLUE,
    marginTop: 20,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE'
  },

  // Sub-headings
  subHeading: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: MID,
    marginTop: 10,
    marginBottom: 4
  },

  // Body
  body: {
    fontSize: 10,
    color: MID,
    lineHeight: 1.5,
    marginBottom: 6
  },

  // Bullet list
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 4
  },
  bullet: {
    fontSize: 10,
    color: BLUE,
    marginRight: 6,
    marginTop: 1
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    color: MID,
    lineHeight: 1.5
  },

  // Role/definition rows
  defRow: {
    flexDirection: 'row',
    marginBottom: 5,
    paddingLeft: 4
  },
  defLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
    width: 110,
    paddingTop: 1
  },
  defValue: {
    flex: 1,
    fontSize: 9,
    color: MID,
    lineHeight: 1.4
  },

  // Tip/note box
  tipBox: {
    backgroundColor: BG_BLUE,
    borderLeftWidth: 3,
    borderLeftColor: BLUE,
    padding: 10,
    marginTop: 8,
    marginBottom: 10,
    borderRadius: 2
  },
  tipLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: BLUE,
    textTransform: 'uppercase',
    marginBottom: 3
  },
  tipText: {
    fontSize: 9,
    color: '#1E40AF',
    lineHeight: 1.4
  },

  // Numbered step
  stepRow: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 4
  },
  stepNum: {
    width: 18,
    height: 18,
    backgroundColor: BLUE,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 1
  },
  stepNumText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: WHITE
  },
  stepText: {
    flex: 1,
    fontSize: 10,
    color: MID,
    lineHeight: 1.5,
    paddingTop: 2
  },

  // Info row (label: value in a grey box)
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
    marginTop: 4
  },
  infoChip: {
    backgroundColor: BG_LIGHT,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  infoChipLabel: {
    fontSize: 7,
    color: MUTED,
    textTransform: 'uppercase',
    marginBottom: 2
  },
  infoChipValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: DARK
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 8
  },
  footerLeft: {
    fontSize: 8,
    color: MUTED
  },
  footerRight: {
    fontSize: 8,
    color: MUTED
  }
})

function Footer({ section }: { section: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerLeft}>Minato — User Guide</Text>
      <Text style={styles.footerRight}>{section}</Text>
    </View>
  )
}

function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  )
}

function Step({ n, children }: { n: number; children: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{children}</Text>
    </View>
  )
}

function Def({ label, children }: { label: string; children: string }) {
  return (
    <View style={styles.defRow}>
      <Text style={styles.defLabel}>{label}</Text>
      <Text style={styles.defValue}>{children}</Text>
    </View>
  )
}

function Tip({ children }: { children: string }) {
  return (
    <View style={styles.tipBox}>
      <Text style={styles.tipLabel}>Tip</Text>
      <Text style={styles.tipText}>{children}</Text>
    </View>
  )
}

export function UserManualDocument() {
  return (
    <Document title='Minato — User Guide'>
      {/* ── COVER PAGE ── */}
      <Page size='A4' style={styles.coverPage}>
        <View style={styles.coverTop}>
          <Text style={styles.coverTag}>User Guide</Text>
          <Text style={styles.coverTitle}>Minato</Text>
          <Text style={styles.coverSubtitle}>
            For Administrators and Workers
          </Text>
          <View style={styles.coverDivider} />
          <Text style={styles.coverMeta}>
            Contains: Admin Guide · Worker Guide
          </Text>
        </View>
        <View style={styles.coverBottom}>
          <Text style={styles.coverNote}>
            This guide covers all features of the Minato platform. Keep it to
            hand for reference. For support, contact your system administrator.
          </Text>
        </View>
      </Page>

      {/* ── ADMIN GUIDE ── */}
      <Page size='A4' style={styles.page}>
        <Footer section='Admin Guide' />

        <View style={styles.sectionBand}>
          <Text style={styles.sectionTag}>Section 1</Text>
          <Text style={styles.sectionTitle}>Admin Guide</Text>
        </View>

        <Text style={styles.body}>
          This section is for staff at your organisation who manage the Minato
          platform — creating documents, assigning them to client companies, and
          tracking sign-offs. Access the admin area from the navigation bar at
          the top of the screen.
        </Text>

        {/* Templates */}
        <Text style={styles.chapterHeading}>1.1 Templates</Text>
        <Text style={styles.body}>
          Templates are the reusable document definitions. Create a template
          once and assign it to any number of client companies. Templates can
          include form fields (to capture information) and comprehension
          questions (to confirm understanding).
        </Text>

        <Text style={styles.subHeading}>Creating a template</Text>
        <Text style={styles.body}>
          Click "New Template", enter a title and description, then save. You
          can add form fields and comprehension questions immediately or return
          to edit them later — neither action creates a new version.
        </Text>

        <Text style={styles.subHeading}>Form fields</Text>
        <Text style={styles.body}>
          Form fields collect information from the worker when they sign.
          Supported field types are:
        </Text>
        <Bullet>Text — a single line of text</Bullet>
        <Bullet>Text area — a longer multi-line response</Bullet>
        <Bullet>Date — a date picker</Bullet>
        <Bullet>Checkbox — a yes/no tick box</Bullet>
        <Text style={[styles.body, { marginTop: 4 }]}>
          Mark a field as "Required" to prevent sign-off unless it is filled in.
          Use conditional logic to show a field only when another checkbox is
          ticked — useful for follow-up questions.
        </Text>

        <Text style={styles.subHeading}>Comprehension questions</Text>
        <Text style={styles.body}>
          Add multiple-choice questions that the worker must answer correctly
          before they can sign. Wrong answers are flagged, and the worker must
          correct them to proceed. The correct answers are never shown to the
          worker.
        </Text>

        <Text style={styles.subHeading}>
          Editing vs. publishing a new version
        </Text>
        <Bullet>
          Edit — for corrections and improvements that do not require workers to
          re-sign. Existing completions are unaffected.
        </Bullet>
        <Bullet>
          Publish New Version — when the document content changes in a
          meaningful way. This creates a fresh sign-off cycle for all assigned
          companies. Workers who already signed the old version must sign the
          new one too. Old completions remain as historical records.
        </Bullet>

        <Tip>
          Use "Edit" for typo fixes and small clarifications. Use "Publish New
          Version" when the document's requirements or procedures have changed
          and workers need to acknowledge the new content.
        </Tip>

        {/* Companies & Assignments */}
        <Text style={styles.chapterHeading}>
          1.2 Companies &amp; Assignments
        </Text>
        <Text style={styles.body}>
          Each client company has its own page accessible from the Companies
          section. This is where you control which documents that company's
          workers need to sign.
        </Text>

        <Text style={styles.subHeading}>Assigning a template to a company</Text>
        <Text style={styles.body}>
          On the company page, click "Assign Template". Select the template and
          optionally set:
        </Text>
        <Bullet>
          Due date — the deadline by which workers must sign. Overdue
          assignments are flagged clearly.
        </Bullet>
        <Bullet>
          Target job roles — restrict the assignment so only workers with
          matching job roles see it. Leave blank to include everyone.
        </Bullet>

        <Text style={styles.subHeading}>Individual assignments</Text>
        <Text style={styles.body}>
          For documents that only one specific person needs to sign, use "Assign
          to User" in the Individual User Templates section on the company page.
        </Text>

        <Text style={styles.subHeading}>Kiosk sign-off link</Text>
        <Text style={styles.body}>
          Every company has a unique kiosk link for workers who do not have
          Minato platform accounts. You can copy the link or display the QR code
          to share it with the company — pin it up at the workplace for workers
          to scan with their phone.
        </Text>
      </Page>

      {/* ADMIN GUIDE continued */}
      <Page size='A4' style={styles.page}>
        <Footer section='Admin Guide' />

        {/* Users */}
        <Text style={styles.chapterHeading}>1.3 Users</Text>
        <Text style={styles.body}>
          Manage all Minato platform accounts from the Users section. You can
          search by name or email.
        </Text>

        <Text style={styles.subHeading}>Adding a user</Text>
        <Text style={styles.body}>
          Click "Add User" and fill in the form. The role and company fields
          determine what the user can see and do.
        </Text>
        <Bullet>
          Email is required for all roles except kiosk-only workers. For a
          worker without an email address, leave the email field blank and
          assign a line manager — the line manager will receive notifications on
          their behalf.
        </Bullet>
        <Bullet>
          If you leave email blank, the worker signs documents via the kiosk
          link only; they cannot log in to the Minato platform.
        </Bullet>

        <Text style={styles.subHeading}>Roles</Text>
        <View style={{ marginBottom: 10 }}>
          <Def label='Platform Admin'>
            Full access to all settings, companies, users, and templates across
            the platform.
          </Def>
          <Def label='Tenant Admin'>
            Full access within your organisation. Can manage all companies,
            users, and templates.
          </Def>
          <Def label='Tenant Staff'>
            Can view documents and manage company workflows, but has limited
            admin access.
          </Def>
          <Def label='Customer Admin'>
            Can log in, view and sign their assigned documents, and see their
            company's completion status.
          </Def>
          <Def label='Customer User'>
            Can log in, view, and sign their own assigned documents.
          </Def>
        </View>

        <Text style={styles.subHeading}>Managing accounts</Text>
        <Text style={styles.body}>
          Use the actions menu (⋯) on any user row to:
        </Text>
        <Bullet>
          View Details — edit display name, job role, and line manager
        </Bullet>
        <Bullet>Change Role — update the user's role</Bullet>
        <Bullet>Reset Password — send a password reset email</Bullet>
        <Bullet>
          Disable / Enable Account — prevents login without deleting the
          account. All completion records are preserved.
        </Bullet>
        <Bullet>Delete User — permanently removes the account</Bullet>

        {/* Completions */}
        <Text style={styles.chapterHeading}>1.4 Completions</Text>
        <Text style={styles.body}>
          The Completions section shows signing progress for a company. Access
          it from the company's overview page.
        </Text>

        <Text style={styles.subHeading}>Status at a glance</Text>
        <View style={{ marginBottom: 10 }}>
          <Def label='Complete'>All workers have signed</Def>
          <Def label='Outstanding (n)'>
            Number of workers who still need to sign
          </Def>
          <Def label='Overdue'>Past the due date with outstanding signers</Def>
        </View>

        <Text style={styles.subHeading}>Detailed records</Text>
        <Text style={styles.body}>
          Click a template row to open the detailed completion view. You can:
        </Text>
        <Bullet>
          View and download individual signed PDFs using the buttons on each row
        </Bullet>
        <Bullet>See who still needs to sign in the Outstanding section</Bullet>
        <Bullet>
          Delete individual records, or select multiple using the checkboxes and
          delete in bulk
        </Bullet>

        <Tip>
          Deleting a completion record is permanent. Download a PDF copy first
          if you need to keep a record.
        </Tip>

        {/* Settings */}
        <Text style={styles.chapterHeading}>1.5 Settings</Text>

        <Text style={styles.subHeading}>Profile permissions</Text>
        <Text style={styles.body}>
          Control which parts of their profile workers are allowed to edit:
          display name, email address, and job role can each be enabled or
          disabled independently.
        </Text>

        <Text style={styles.subHeading}>Security</Text>
        <Text style={styles.body}>
          Configure password rules for all user accounts: minimum password
          length, expiry period, password history enforcement, and session
          timeout. Changes take effect the next time a user logs in or resets
          their password.
        </Text>
      </Page>

      {/* ── WORKER GUIDE ── */}
      <Page size='A4' style={styles.page}>
        <Footer section='Worker Guide' />

        <View style={styles.sectionBand}>
          <Text style={styles.sectionTag}>Section 2</Text>
          <Text style={styles.sectionTitle}>Worker Guide</Text>
        </View>

        <Text style={styles.body}>
          This section is for workers who need to sign health and safety
          documents. You may access the Minato platform by logging in with your
          account, or by using the kiosk link provided by your employer — you do
          not need both.
        </Text>

        {/* Signing in */}
        <Text style={styles.chapterHeading}>2.1 Signing In</Text>
        <Text style={styles.body}>
          Open the Minato platform address given to you by your administrator.
          Enter your email address and password, then click "Sign In".
        </Text>

        <Text style={styles.subHeading}>Forgotten password</Text>
        <Text style={styles.body}>
          Click "Forgot your password?" on the sign-in page. Enter your email
          address and a reset link will be sent to your inbox. The link expires
          after one hour.
        </Text>

        <Tip>
          If you do not have an account or email address, ask your employer for
          the kiosk link — see section 2.4.
        </Tip>

        {/* My Documents */}
        <Text style={styles.chapterHeading}>2.2 Your Documents</Text>
        <Text style={styles.body}>
          After signing in, click "My Documents" in the navigation bar at the
          top of the screen. You will see a list of all documents assigned to
          you, showing the title, a description, and the due date where
          applicable. Documents past their due date are marked as overdue.
        </Text>

        {/* Signing a document */}
        <Text style={styles.chapterHeading}>2.3 Signing a Document</Text>
        <Text style={styles.body}>
          Click on a document from your list to open it, then follow these
          steps:
        </Text>
        <View style={{ marginTop: 6, marginBottom: 10 }}>
          <Step n={1}>
            Fill in any fields shown on the form. Fields marked with * are
            required.
          </Step>
          <Step n={2}>
            If comprehension questions appear, select your answers. You must
            answer all questions correctly before you can sign. If an answer is
            wrong, you will be told which question to revisit.
          </Step>
          <Step n={3}>
            Click "Sign off document". A confirmation message appears and a PDF
            record is saved automatically.
          </Step>
        </View>

        <Text style={styles.body}>
          Once you have signed a document it will no longer appear in your list.
          Your employer can view and download your signed record at any time.
        </Text>

        {/* Profile */}
        <Text style={styles.chapterHeading}>2.4 Your Profile</Text>
        <Text style={styles.body}>
          Click your name in the top right corner, then select "Profile". You
          can view your account details and, depending on what your
          administrator has enabled, update your display name, email address,
          and job role.
        </Text>

        <Text style={styles.subHeading}>Changing your password</Text>
        <Text style={styles.body}>
          On the Profile page, scroll to "Change Password". Enter your current
          password, then your new password twice, and click "Change Password".
        </Text>

        {/* Kiosk */}
        <Text style={styles.chapterHeading}>2.5 Kiosk Sign-Off</Text>
        <Text style={styles.body}>
          If you do not have a Minato platform account, your employer will give
          you a link or a QR code printed at the workplace. Open this link on
          any phone or computer — no password is needed.
        </Text>

        <View style={{ marginTop: 6, marginBottom: 10 }}>
          <Step n={1}>
            Select your name from the dropdown list on the kiosk page.
          </Step>
          <Step n={2}>
            Your outstanding documents will appear below your name. Choose the
            one you need to sign.
          </Step>
          <Step n={3}>
            Fill in any required fields and answer any comprehension questions.
          </Step>
          <Step n={4}>
            Click "Sign off document". You will see a confirmation screen.
          </Step>
        </View>

        <Text style={styles.body}>
          You can sign multiple documents in one visit — after each one, you
          will be returned to the kiosk page to select your name again.
        </Text>

        <Tip>
          The kiosk page is public — anyone with the link can use it. Do not
          select another person's name. Your employer monitors who signs each
          document.
        </Tip>

        {/* Quick reference */}
        <Text style={styles.chapterHeading}>Quick Reference</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoChip}>
            <Text style={styles.infoChipLabel}>Sign in</Text>
            <Text style={styles.infoChipValue}>
              Minato platform URL → email + password
            </Text>
          </View>
          <View style={styles.infoChip}>
            <Text style={styles.infoChipLabel}>My documents</Text>
            <Text style={styles.infoChipValue}>"My Documents" in nav bar</Text>
          </View>
          <View style={styles.infoChip}>
            <Text style={styles.infoChipLabel}>Reset password</Text>
            <Text style={styles.infoChipValue}>
              "Forgot your password?" on sign-in
            </Text>
          </View>
          <View style={styles.infoChip}>
            <Text style={styles.infoChipLabel}>No account?</Text>
            <Text style={styles.infoChipValue}>
              Use kiosk link from employer
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

export async function generateUserManualPDF(): Promise<Buffer> {
  return renderToBuffer(<UserManualDocument />)
}
