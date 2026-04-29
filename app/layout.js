import Script from 'next/script';
import './globals.css';
import TaskNotesPatch from './TaskNotesPatch';

export const metadata = {
  title: 'PriorityOS — Calendar Sync',
  description: 'Decide, do, and deliver with Google Calendar sync and Vercel Blob storage.'
};

const workspaceFetchPatch = `
(function(){
  if (window.__priorityOSWorkspaceFetchPatch) return;
  window.__priorityOSWorkspaceFetchPatch = true;
  var originalFetch = window.fetch.bind(window);
  function getMode(){
    try { return localStorage.getItem('priorityos.mode') === 'personal' ? 'personal' : 'business'; }
    catch(e){ return 'business'; }
  }
  function withMode(url){
    var mode = getMode();
    var separator = url.indexOf('?') === -1 ? '?' : '&';
    return url + separator + 'mode=' + encodeURIComponent(mode);
  }
  window.fetch = function(input, init){
    var url = typeof input === 'string' ? input : input && input.url;
    var method = String((init && init.method) || 'GET').toUpperCase();
    if (url && url.indexOf('/api/state') !== -1) {
      if (typeof input === 'string') input = withMode(input);
      else if (input && input.url) input = new Request(withMode(input.url), input);
      if (method === 'PUT' && init && init.body) {
        try {
          var body = JSON.parse(init.body);
          body.mode = getMode();
          init = Object.assign({}, init, { body: JSON.stringify(body) });
        } catch(e) {}
      }
    }
    return originalFetch(input, init);
  };
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Script id="priorityos-workspace-fetch" strategy="beforeInteractive">{workspaceFetchPatch}</Script>
        {children}
        <TaskNotesPatch />
      </body>
    </html>
  );
}
