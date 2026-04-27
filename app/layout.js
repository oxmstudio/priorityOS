import './globals.css';

export const metadata = {
  title: 'PriorityOS — Calendar Sync',
  description: 'Decide, do, and deliver with Google Calendar sync and Vercel Blob storage.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
