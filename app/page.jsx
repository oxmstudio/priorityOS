'use client';

import { useEffect, useState } from 'react';

const GOOGLE_CONNECT = '/api/auth/google?returnTo=/dashboard';

export default function Home() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    fetch('/api/auth/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data.connected) {
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

  if (checking) {
    return (
      <main className="landing-loading">
        <div className="landing-loading-mark">P</div>
        <span>Loading PriorityOS…</span>
      </main>
    );
  }

  return (
    <main className="landing landing-hero-only">
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
  );
}
