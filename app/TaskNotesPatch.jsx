'use client';

import { useEffect } from 'react';

export default function TaskNotesPatch() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      const method = String(init?.method || 'GET').toUpperCase();
      const isCalendarPost = url.includes('/api/calendar/events') && method === 'POST' && init?.body;

      if (isCalendarPost) {
        try {
          const body = JSON.parse(init.body);
          const notes = document.getElementById('sch-task-notes')?.value?.trim();
          if (notes) {
            body.task = { ...(body.task || {}), notes };
            init = { ...init, body: JSON.stringify(body) };
          }
        } catch (_error) {}
      }

      return originalFetch(input, init);
    };

    const addNotesBox = () => {
      if (document.getElementById('sch-task-notes')) return;
      const taskSelect = document.getElementById('sch-task-sel');
      const syncButton = [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Schedule Task'));
      if (!taskSelect || !syncButton) return;

      const wrapper = document.createElement('div');
      wrapper.id = 'sch-task-notes-wrap';
      wrapper.style.marginTop = '12px';
      wrapper.innerHTML = `
        <div class="field-lbl">Task notes</div>
        <textarea id="sch-task-notes" placeholder="Add notes, context, next actions, links, or delegation details before syncing to Google Calendar…"></textarea>
      `;

      syncButton.parentElement?.insertAdjacentElement('beforebegin', wrapper);
    };

    addNotesBox();
    const observer = new MutationObserver(addNotesBox);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
