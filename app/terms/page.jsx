export const metadata = {
  title: 'Terms of Service — PriorityOS',
  description: 'Terms of Service for PriorityOS.'
};

export default function TermsOfServicePage() {
  return (
    <main className="main" style={{ paddingTop: 120 }}>
      <section className="card">
        <div className="sh-tag lg" style={{ color: 'var(--amber)' }}>
          <span className="sh-dot" style={{ background: 'var(--amber)' }} /> Legal
        </div>
        <h1 className="sh-title">Terms of <span className="serif">Service</span></h1>
        <p className="sh-sub">Last updated: April 29, 2026</p>

        <div className="legal-copy">
          <p>
            These Terms of Service govern your access to and use of PriorityOS, a productivity app for organizing priorities, managing Business and Personal dashboards, and optionally syncing scheduled tasks to Google Calendar.
          </p>

          <h2>Acceptance of terms</h2>
          <p>
            By using PriorityOS, you agree to these Terms. If you do not agree, do not use the app.
          </p>

          <h2>Use of the service</h2>
          <p>
            PriorityOS is provided to help you organize tasks, values, goals, and schedules. You are responsible for the information you enter and for reviewing calendar events created by the app.
          </p>

          <h2>Accounts and Google Calendar connection</h2>
          <p>
            You may use PriorityOS locally without connecting Google Calendar. To save dashboards to the cloud and schedule events, you must connect a Google account. You are responsible for maintaining control of your Google account and for revoking access if you no longer want PriorityOS connected.
          </p>

          <h2>User content</h2>
          <p>
            You retain ownership of the values, goals, tasks, notes, and scheduling details you enter into PriorityOS. You grant PriorityOS permission to store, process, and sync this information only as needed to operate the app.
          </p>

          <h2>Calendar events</h2>
          <p>
            PriorityOS may create, update, or delete Google Calendar events based on actions you take inside the app. You are responsible for confirming that scheduled events, recurrence rules, dates, and times are accurate.
          </p>

          <h2>Acceptable use</h2>
          <p>You agree not to misuse PriorityOS, including by attempting to:</p>
          <ul>
            <li>Access another user’s dashboard or calendar without permission.</li>
            <li>Interfere with the app’s operation, security, or infrastructure.</li>
            <li>Use the app for unlawful, harmful, or abusive activity.</li>
            <li>Reverse engineer, scrape, or overload the app except where legally permitted.</li>
          </ul>

          <h2>No professional advice</h2>
          <p>
            PriorityOS is a productivity and planning tool. It does not provide legal, financial, medical, tax, or professional advice. Decisions you make based on your tasks, priorities, or calendar remain your responsibility.
          </p>

          <h2>Availability</h2>
          <p>
            We may modify, suspend, or discontinue PriorityOS at any time. We do not guarantee uninterrupted or error-free operation.
          </p>

          <h2>Disclaimer</h2>
          <p>
            PriorityOS is provided “as is” and “as available,” without warranties of any kind, express or implied, including warranties of merchantability, fitness for a particular purpose, and non-infringement.
          </p>

          <h2>Limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, the PriorityOS operator will not be liable for indirect, incidental, special, consequential, or punitive damages, or for loss of profits, data, goodwill, or business opportunities arising from your use of the app.
          </p>

          <h2>Termination</h2>
          <p>
            We may suspend or terminate access if you violate these Terms or misuse the service. You may stop using PriorityOS at any time and revoke Google access from your Google Account settings.
          </p>

          <h2>Changes to terms</h2>
          <p>
            We may update these Terms from time to time. Updates will be posted on this page with a revised “Last updated” date.
          </p>

          <h2>Contact</h2>
          <p>
            For questions about these Terms, contact the PriorityOS operator at: <strong>legal@priorityos.app</strong>. Replace this email with your active support or legal contact before public launch.
          </p>
        </div>
      </section>
    </main>
  );
}
