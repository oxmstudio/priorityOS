'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [checking, setChecking] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let active = true;

    fetch('/api/auth/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data.connected) {
          setConnected(true);
          window.location.replace('/dashboard');
        } else {
          setChecking(false);
        }
      })
      .catch(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (checking || connected) {
    return (
      <main className="landing-loading">
        <div className="landing-loading-mark">P</div>
        <span>Loading PriorityOS…</span>
      </main>
    );
  }

  return (
    <>
      <nav className="landing-nav">
        <a className="logo" href="/">
          <div className="logo-icon">P</div>
          <span className="logo-name">PriorityOS</span>
        </a>
        <a className="btn-cal" href="/api/auth/google?returnTo=/dashboard">
          Sync Google Calendar
        </a>
      </nav>

      <main className="landing">
        <section className="landing-hero">
          <div className="tag-pill lg">
            <span className="tag-new">PriorityOS</span>
            <span className="tag-txt">Prioritize first. Schedule second.</span>
          </div>

          <h1>
            Turn your priorities into a
            <span className="serif"> calendar you can trust.</span>
          </h1>

          <p className="landing-lead">
            PriorityOS gives your work a simple operating system: capture what matters,
            decide what deserves attention, and turn the right work into intentional
            calendar time.
          </p>

          <a className="landing-cta btn-cal" href="/api/auth/google?returnTo=/dashboard">
            Sync Google Calendar
          </a>

          <p className="landing-note">
            Connect your Google Calendar and you’ll go straight to your dashboard.
          </p>
        </section>

        <section className="landing-overview" aria-label="PriorityOS overview">
          <article className="landing-card">
            <div className="landing-num">01</div>
            <div>
              <span className="landing-kicker green">Prioritize</span>
              <h2>Start with what matters.</h2>
              <p>
                Define values and goals, then use the Eisenhower Matrix to separate
                urgent work from meaningful work.
              </p>
            </div>
          </article>

          <article className="landing-card">
            <div className="landing-num">02</div>
            <div>
              <span className="landing-kicker blue">Plan</span>
              <h2>Turn decisions into action.</h2>
              <p>
                Capture operational work and projects in one place, with enough
                structure to know what should happen next.
              </p>
            </div>
          </article>

          <article className="landing-card">
            <div className="landing-num">03</div>
            <div>
              <span className="landing-kicker amber">Schedule</span>
              <h2>Give priorities a place on the calendar.</h2>
              <p>
                Schedule the work that deserves time and sync it directly with Google
                Calendar, including recurring operational routines.
              </p>
            </div>
          </article>
        </section>

        <section className="landing-feature">
          <div>
            <span className="landing-kicker blue">One command center</span>
            <h2>See the whole operating system in one dashboard.</h2>
            <p>
              Your dashboard brings together priorities, calendar events, canvas work,
              statistics, habits, and personal or business workspaces.
            </p>
          </div>

          <div className="landing-metric-grid">
            <div className="landing-metric"><strong>Goals</strong><span>SMART objectives</span></div>
            <div className="landing-metric"><strong>Tasks</strong><span>Priority pipeline</span></div>
            <div className="landing-metric"><strong>Calendar</strong><span>Intentional time blocks</span></div>
            <div className="landing-metric"><strong>Habits</strong><span>Recurring accountability</span></div>
          </div>
        </section>

        <section className="landing-bottom-cta">
          <h2>Ready to get your priorities onto the calendar?</h2>
          <a className="btn-cal" href="/api/auth/google?returnTo=/dashboard">
            Sync Google Calendar
          </a>
        </section>
      </main>

      <footer className="site-footer landing-footer">
        <span>PriorityOS</span>
        <a href="/dashboard?view=privacy">Privacy</a>
        <a href="/dashboard?view=terms">Terms</a>
      </footer>
    </>
  );
}
