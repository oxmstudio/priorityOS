import CalendarClient from './CalendarClient';

export const metadata = {
  title: 'Calendar — PriorityOS Dashboard',
  description: 'Your internal PriorityOS calendar.'
};

export default function CalendarPage() {
  return <CalendarClient />;
}
