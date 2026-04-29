import './globals.css';
import TaskNotesPatch from './TaskNotesPatch';

export const metadata = {
  title: 'PriorityOS — Calendar Sync',
  description: 'Decide, do, and deliver with Google Calendar sync and Vercel Blob storage.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <TaskNotesPatch />
      </body>
    </html>
  );
}
