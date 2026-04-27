import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { getAuthedOAuthClient } from '../../../../lib/google';
import { getSession } from '../../../../lib/session';

export const runtime = 'nodejs';

function calendarForSession() {
  const session = getSession();
  const auth = getAuthedOAuthClient(session);
  if (!auth) return null;
  return google.calendar({ version: 'v3', auth });
}

function recurrenceLabel(rule) {
  if (!rule) return 'Once';
  if (rule.includes('BYDAY=MO,TU,WE,TH,FR')) return 'Weekdays';
  if (rule.includes('DAILY')) return 'Daily';
  if (rule.includes('WEEKLY')) return 'Weekly';
  if (rule.includes('MONTHLY')) return 'Monthly';
  return rule;
}

function quadrantLabel(quadrant) {
  const labels = {
    q1: 'Do It Now — Important + Urgent',
    q2: 'Schedule It — Important + Not Urgent',
    q3: 'Delegate It — Not Important + Urgent',
    q4: 'Delete It — Not Important + Not Urgent'
  };
  return labels[quadrant] || null;
}

function quadrantColor(quadrant, fallback) {
  const colors = { q1: '11', q2: '10', q3: '5', q4: '8' };
  return colors[quadrant] || fallback;
}

function eventDescription(task, context = {}) {
  const lines = [
    '📋 PriorityOS Task',
    task.type === 'op' ? `🔄 Recurring: ${recurrenceLabel(task.recRule)}` : '📅 Project task',
    task.quadrant ? `⚡ Priority: ${quadrantLabel(task.quadrant)}` : '',
    Array.isArray(context.goals) && context.goals.length ? `🎯 Goals: ${context.goals.slice(0, 2).join(' | ')}` : '',
    Array.isArray(context.values) && context.values.length ? `💎 Values: ${context.values.slice(0, 3).join(', ')}` : '',
    '',
    'Created via PriorityOS — Decide · Do · Deliver'
  ];
  return lines.filter(Boolean).join('\n');
}

export async function POST(request) {
  const calendar = calendarForSession();
  if (!calendar) return NextResponse.json({ error: 'Google Calendar is not connected.' }, { status: 401 });

  try {
    const { task, context } = await request.json();
    if (!task?.name || !task?.start || !task?.end || !task?.tz) {
      return NextResponse.json({ error: 'Task name, start, end, and timezone are required.' }, { status: 400 });
    }

    const requestBody = {
      summary: task.name,
      description: eventDescription(task, context),
      start: { dateTime: task.start, timeZone: task.tz },
      end: { dateTime: task.end, timeZone: task.tz },
      colorId: task.type === 'op' ? '7' : '5'
    };

    if (task.type === 'op' && task.recRule) requestBody.recurrence = [task.recRule];

    const { data } = await calendar.events.insert({ calendarId: 'primary', requestBody });
    return NextResponse.json({ eventId: data.id, link: data.htmlLink || '' });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Calendar event creation failed.' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const calendar = calendarForSession();
  if (!calendar) return NextResponse.json({ error: 'Google Calendar is not connected.' }, { status: 401 });

  try {
    const { task, context } = await request.json();
    if (!task?.eventId) return NextResponse.json({ error: 'eventId is required to update a calendar event.' }, { status: 400 });

    const { data } = await calendar.events.patch({
      calendarId: 'primary',
      eventId: task.eventId,
      requestBody: {
        description: eventDescription(task, context),
        colorId: quadrantColor(task.quadrant, task.type === 'op' ? '7' : '5')
      }
    });

    return NextResponse.json({ eventId: data.id, link: data.htmlLink || task.calLink || '' });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Calendar event update failed.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const calendar = calendarForSession();
  if (!calendar) return NextResponse.json({ error: 'Google Calendar is not connected.' }, { status: 401 });

  try {
    const { eventId } = await request.json();
    if (!eventId) return NextResponse.json({ error: 'eventId is required to delete a calendar event.' }, { status: 400 });
    await calendar.events.delete({ calendarId: 'primary', eventId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Calendar event delete failed.' }, { status: 500 });
  }
}
