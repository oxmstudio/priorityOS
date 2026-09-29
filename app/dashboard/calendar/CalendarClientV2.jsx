'use client';

import { useEffect } from 'react';

export default function CalendarClientV2() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode') === 'personal' ? 'personal' : 'business';
    const local = params.get('local') === '1' ? '&local=1' : '';
    window.location.replace(`/dashboard?mode=${mode}&view=calendar${local}`);
  }, []);

  return (
    <main className="main" style={{ paddingTop: 120 }}>
      <section className="card">
        <h1 className="sh-title">Opening your <span className="serif">calendar.</span></h1>
        <p className="sh-sub">Loading the PriorityOS dashboard calendar…</p>
      </section>
    </main>
  );
}
