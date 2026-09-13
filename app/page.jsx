'use client';

import { useEffect, useState } from 'react';

const GOOGLE_CONNECT = '/api/auth/google?returnTo=/dashboard';

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
        <a className="btn-cal" href={GOOGLE_CONNECT}>
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

          <a className="landing-cta btn-cal" href={GOOGLE_CONNECT}>
            Open Priority Manager
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
