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

    const getMode = () => localStorage.getItem('priorityos.mode') === 'personal' ? 'personal' : 'business';

    const addWorkspaceToggle = () => {
      if (document.getElementById('priorityos-workspace-toggle')) return;
      const main = document.getElementById('app');
      if (!main) return;

      const mode = getMode();
      const wrapper = document.createElement('div');
      wrapper.id = 'priorityos-workspace-toggle';
      wrapper.className = 'lg';
      wrapper.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;border-radius:15px;padding:14px 16px;margin-bottom:18px;';
      wrapper.innerHTML = `
        <div>
          <div class="card-hdr" style="margin-bottom:4px;">Workspace</div>
          <div style="font-size:13px;color:var(--muted);line-height:1.45;">Switch between separate Business and Personal priority systems.</div>
        </div>
        <div class="ttog" style="min-width:240px;margin-bottom:0;">
          <button type="button" data-mode="business" class="ttbtn ${mode === 'business' ? 'op' : ''}">Business</button>
          <button type="button" data-mode="personal" class="ttbtn ${mode === 'personal' ? 'pr' : ''}">Personal</button>
        </div>
      `;
      main.insertAdjacentElement('afterbegin', wrapper);
      wrapper.querySelectorAll('button[data-mode]').forEach((button) => {
        button.addEventListener('click', () => {
          const nextMode = button.dataset.mode === 'personal' ? 'personal' : 'business';
          if (nextMode === getMode()) return;
          localStorage.setItem('priorityos.mode', nextMode);
          window.location.reload();
        });
      });
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

    const enhance = () => {
      addWorkspaceToggle();
      addNotesBox();
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
