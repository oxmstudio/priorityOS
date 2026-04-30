export const metadata = {
  title: 'Privacy Policy — PriorityOS',
  description: 'Privacy Policy for PriorityOS.'
};

export default function PrivacyPolicyPage() {
  return (
    <main className="main" style={{ paddingTop: 120 }}>
      <section className="card">
        <div className="sh-tag lg" style={{ color: 'var(--blue)' }}>
          <span className="sh-dot" style={{ background: 'var(--blue)' }} /> Legal
        </div>
        <h1 className="sh-title">Privacy <span className="serif">Policy</span></h1>
        <p className="sh-sub">Last updated: April 29, 2026</p>

        <div className="legal-copy">
          <p>
            PriorityOS helps users organize priorities, create separate Business and Personal dashboards, and optionally sync scheduled tasks to Google Calendar. This Privacy Policy explains what information we collect, how we use it, and how you can control your data.
          </p>

          <h2>Information we collect</h2>
          <p>When you use PriorityOS without connecting Google Calendar, your dashboard information may be stored locally in your browser. When you connect Google Calendar, we may collect and store the following information:</p>
          <ul>
            <li>Your Google account email address and basic profile information used to identify your account.</li>
            <li>PriorityOS dashboard data you enter, including values, goals, tasks, notes, task classifications, workspace mode, and scheduling details.</li>
            <li>Google Calendar event IDs and links for events created by PriorityOS.</li>
            <li>Authentication tokens required to keep your Google Calendar connection active.</li>
          </ul>

          <h2>Google Calendar data</h2>
          <p>
            PriorityOS uses Google Calendar access only to create, update, and delete calendar events that you schedule from within PriorityOS. We do not sell Google user data, use it for advertising, or transfer it to third parties except as necessary to provide the app’s calendar sync functionality.
          </p>
          <p>
            PriorityOS requests access to your Google profile and Google Calendar event permissions so it can connect your account, save your dashboard, and sync events to your own calendar.
          </p>

          <h2>How we use information</h2>
          <ul>
            <li>To save and load your PriorityOS dashboard.</li>
            <li>To separate your Business and Personal workspaces.</li>
            <li>To create scheduled tasks on your Google Calendar.</li>
            <li>To display calendar sync status and links to events you created.</li>
            <li>To maintain account security and app reliability.</li>
          </ul>

          <h2>How information is stored</h2>
          <p>
            Connected account dashboard data is stored using Vercel Blob storage. Google authentication tokens are stored in encrypted, HttpOnly cookies. Local-only users may have data stored in browser local storage until they connect an account.
          </p>

          <h2>Sharing and disclosure</h2>
          <p>
            We do not sell your personal information. We may process data through service providers necessary to operate the app, such as Vercel for hosting and storage and Google for calendar synchronization.
          </p>

          <h2>Your choices</h2>
          <ul>
            <li>You can disconnect Google Calendar from within PriorityOS.</li>
            <li>You can revoke PriorityOS access from your Google Account permissions page.</li>
            <li>You can delete locally stored browser data by clearing site data in your browser.</li>
            <li>You can request deletion of cloud-stored dashboard data by contacting the app operator.</li>
          </ul>

          <h2>Data retention</h2>
          <p>
            We retain dashboard data while your account remains active or as needed to provide the service. If you request deletion, we will make reasonable efforts to delete your cloud-stored dashboard data.
          </p>

          <h2>Security</h2>
          <p>
            We use reasonable technical safeguards, including encrypted session cookies and server-side OAuth handling. No method of transmission or storage is perfectly secure, so we cannot guarantee absolute security.
          </p>

          <h2>Children’s privacy</h2>
          <p>
            PriorityOS is not intended for children under 13. We do not knowingly collect personal information from children under 13.
          </p>

          <h2>Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Updates will be posted on this page with a revised “Last updated” date.
          </p>

          <h2>Contact</h2>
          <p>
            For privacy questions or deletion requests, contact the PriorityOS operator at: <strong>legal@priorityos.app</strong>. Replace this email with your active support or legal contact before public launch.
          </p>
        </div>
      </section>
    </main>
  );
}
