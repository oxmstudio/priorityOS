'use client';

import { useEffect } from 'react';

export default function TaskNotesPatch() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    let pendingSaveInFlight = false;

    function getMode() {
      return localStorage.getItem('priorityos.mode') === 'personal' ? 'personal' : 'business';
    }

    function isConnected() {
      return !!document.querySelector('.cal-status.connected') || !!document.querySelector('.tag-pill .tag-txt')?.textContent?.includes('@');
    }

    function schedulerRoot() {
      return document.getElementById('sch-task-sel')?.closest('.card') || document;
    }

    function activeText(selector) {
      const root = schedulerRoot();
      return [...root.querySelectorAll(selector)].find((button) => button.className.includes('active') || button.className.includes('op') || button.className.includes('pr'))?.textContent?.trim() || '';
    }

    function selectedTaskName() {
      const option = document.getElementById('sch-task-sel')?.selectedOptions?.[0]?.textContent || 'Untitled task';
      return option.split(' — ')[0].trim();
    }

    function quadrantFromSelectedTask() {
      const option = document.getElementById('sch-task-sel')?.selectedOptions?.[0]?.textContent || '';
      if (option.includes('Do It Now')) return 'q1';
      if (option.includes('Investment')) return 'q2';
      if (option.includes('Delegate')) return 'q3';
      if (option.includes('Delete')) return 'q4';
      return null;
    }

    function buildSchedulePayload() {
      const root = schedulerRoot();
      const isOperational = activeText('.ttog .ttbtn').includes('Operational');
      const notes = document.getElementById('sch-task-notes')?.value?.trim() || '';
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const title = selectedTaskName();
      const quadrant = quadrantFromSelectedTask();
      let start;
      let end;
      let recRule = null;
      let type = 'pr';

      if (isOperational) {
        const date = document.getElementById('sch-op-date')?.value || new Date().toISOString().slice(0, 10);
        const time = document.getElementById('sch-op-time')?.value || '09:00';
        const duration = Number.parseInt(document.getElementById('sch-op-dur')?.value || '60', 10) || 60;
        start = `${date}T${time}:00`;
        const endDate = new Date(start);
        endDate.setMinutes(endDate.getMinutes() + duration);
        end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}T${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}:00`;
        type = 'op';
        const recText = activeText('.rec-opts .rec-btn');
        if (recText.includes('Monthly')) recRule = 'RRULE:FREQ=MONTHLY';
        else if (recText.includes('Weekdays')) recRule = 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
        else if (recText.includes('Weekly')) {
          const days = [...root.querySelectorAll('.rec-opts .rec-btn.active')]
            .map((button) => button.textContent.trim())
            .filter((label) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].includes(label))
            .map((label) => ({ Mon: 'MO', Tue: 'TU', Wed: 'WE', Thu: 'TH', Fri: 'FR', Sat: 'SA', Sun: 'SU' }[label]));
          recRule = `RRULE:FREQ=WEEKLY;BYDAY=${days.length ? days.join(',') : 'MO'}`;
        } else recRule = 'RRULE:FREQ=DAILY';
      } else {
        const date = document.getElementById('sch-pr-date')?.value || new Date().toISOString().slice(0, 10);
        const st = document.getElementById('sch-pr-start')?.value || '09:00';
        const et = document.getElementById('sch-pr-end')?.value || '10:00';
        start = `${date}T${st}:00`;
        end = `${date}T${et}:00`;
      }

      return { task: { name: title, notes, type, quadrant, recRule, start, end, tz }, mode: getMode() };
    }

    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      const method = String(init?.method || 'GET').toUpperCase();
      const isCalendarPost = url.includes('/api/calendar/events') && method === 'POST' && init?.body;

      if (isCalendarPost) {
        try {
          const body = JSON.parse(init.body);
          const notes = document.getElementById('sch-task-notes')?.value?.trim();
          if (notes) body.task = { ...(body.task || {}), notes };
          init = { ...init, body: JSON.stringify(body) };
        } catch (_error) {}
      }

      const response = await originalFetch(input, init);
      if (isCalendarPost && response.ok && window.location.pathname !== '/dashboard') {
        setTimeout(() => { window.location.href = '/dashboard'; }, 1200);
      }
      return response;
    };

    async function postInternalCalendarEvent(payload) {
      const response = await originalFetch(`/api/calendar/internal?mode=${payload.mode || getMode()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Internal calendar save failed.');
      return data;
    }

    async function resumePendingInternalSave() {
      if (pendingSaveInFlight || !isConnected()) return;
      const raw = localStorage.getItem('priorityos.pendingInternalEvent');
      if (!raw) return;
      pendingSaveInFlight = true;
      try {
        const payload = JSON.parse(raw);
        await postInternalCalendarEvent(payload);
        localStorage.removeItem('priorityos.pendingInternalEvent');
        window.location.href = '/dashboard/calendar';
      } catch (_error) {
        pendingSaveInFlight = false;
      }
    }

    async function saveInternalCalendarEvent() {
      const payload = buildSchedulePayload();
      if (!isConnected()) {
        localStorage.setItem('priorityos.pendingInternalEvent', JSON.stringify(payload));
        window.location.href = '/api/auth/google?returnTo=/dashboard/planner';
        return;
      }
      const button = document.getElementById('priorityos-save-internal-calendar');
      if (button) button.textContent = 'Saving to PriorityOS…';
      try {
        await postInternalCalendarEvent(payload);
        if (button) button.textContent = 'Saved to PriorityOS Calendar ✓';
        setTimeout(() => { window.location.href = '/dashboard/calendar'; }, 700);
      } catch (error) {
        if (button) button.textContent = error.message || 'Internal calendar save failed';
      }
    }

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
        </div>`;
      main.insertAdjacentElement('afterbegin', wrapper);
      wrapper.querySelectorAll('button[data-mode]').forEach((button) => button.addEventListener('click', () => {
        const nextMode = button.dataset.mode === 'personal' ? 'personal' : 'business';
        if (nextMode === getMode()) return;
        localStorage.setItem('priorityos.mode', nextMode);
        window.location.reload();
      }));
    };

    const addSignupGate = () => {
      const taskSelect = document.getElementById('sch-task-sel');
      const syncButton = [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Schedule Task'));
      if (!taskSelect || !syncButton) return;
      const existing = document.getElementById('priorityos-signup-gate');
      if (isConnected()) { existing?.remove(); return; }
      if (existing) return;
      const gate = document.createElement('div');
      gate.id = 'priorityos-signup-gate';
      gate.className = 'hint';
      gate.style.margin = '12px 0 0';
      gate.innerHTML = `<h4>Create your account to schedule</h4><p>Your dashboard is saved locally while you plan. Connect to create a private account and save events to your PriorityOS calendar.</p><a class="btn-cal" href="/api/auth/google?returnTo=/dashboard/planner" style="display:inline-flex;margin-top:10px;text-decoration:none;">Create Account</a>`;
      syncButton.parentElement?.insertAdjacentElement('beforebegin', gate);
    };

    const addNotesBox = () => {
      if (document.getElementById('sch-task-notes')) return;
      const taskSelect = document.getElementById('sch-task-sel');
      const syncButton = [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Schedule Task'));
      if (!taskSelect || !syncButton) return;
      const wrapper = document.createElement('div');
      wrapper.id = 'sch-task-notes-wrap';
      wrapper.style.marginTop = '12px';
      wrapper.innerHTML = `<div class="field-lbl">Task notes</div><textarea id="sch-task-notes" placeholder="Add notes, context, next actions, links, or delegation details…"></textarea>`;
      syncButton.parentElement?.insertAdjacentElement('beforebegin', wrapper);
    };

    const addInternalCalendarButton = () => {
      if (document.getElementById('priorityos-save-internal-calendar')) return;
      const syncButton = [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Schedule Task'));
      if (!syncButton) return;
      const button = document.createElement('button');
      button.id = 'priorityos-save-internal-calendar';
      button.className = 'btn-full btn-ghost';
      button.type = 'button';
      button.style.marginTop = '8px';
      button.textContent = 'Save to PriorityOS Calendar Only';
      button.addEventListener('click', saveInternalCalendarEvent);
      syncButton.parentElement?.insertAdjacentElement('afterend', button);
    };

    const enhance = () => {
      if (window.location.pathname !== '/dashboard') addWorkspaceToggle();
      addSignupGate();
      addNotesBox();
      addInternalCalendarButton();
      resumePendingInternalSave();
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
