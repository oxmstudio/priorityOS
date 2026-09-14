import Script from 'next/script';
import './globals.css';
import './calendar.css';
import './workboard.css';
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

  function setupAccountMenu(){
    var profile = document.querySelector('.dash-profile');
    if (!profile || profile.dataset.accountMenuReady === '1') return;
    profile.dataset.accountMenuReady = '1';
    profile.style.cursor = 'pointer';
    profile.style.position = 'relative';
    profile.setAttribute('role','button');
    profile.setAttribute('tabindex','0');
    profile.setAttribute('aria-label','Account menu');

    var menu = document.createElement('div');
    menu.style.cssText = 'position:absolute;right:0;top:calc(100% + 10px);min-width:190px;padding:7px;background:#101010;border:1px solid rgba(255,255,255,.14);border-radius:12px;box-shadow:0 18px 45px rgba(0,0,0,.55);z-index:1000;display:none;';
    menu.innerHTML = '<button data-account-action="switch" style="display:block;width:100%;padding:10px 12px;border:0;border-radius:8px;background:transparent;color:#fff;text-align:left;font:500 12px Inter,sans-serif;cursor:pointer">Switch Google account</button><button data-account-action="logout" style="display:block;width:100%;padding:10px 12px;border:0;border-radius:8px;background:transparent;color:rgba(255,255,255,.7);text-align:left;font:500 12px Inter,sans-serif;cursor:pointer">Log out</button>';
    profile.appendChild(menu);

    function close(){menu.style.display='none';}
    function toggle(e){
      if(e) e.stopPropagation();
      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
    profile.addEventListener('click', function(e){
      if(e.target.closest('[data-account-action]')) return;
      toggle(e);
    });
    profile.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){e.preventDefault();toggle(e);}
    });
    menu.addEventListener('click', async function(e){
      var action = e.target.closest('[data-account-action]')?.getAttribute('data-account-action');
      if(!action) return;
      close();
      if(action === 'switch'){
        try { await originalFetch('/api/auth/logout',{method:'POST'}); } catch(_e) {}
        window.location.href='/api/auth/google?returnTo=/dashboard';
      } else {
        try { await originalFetch('/api/auth/logout',{method:'POST'}); } catch(_e) {}
        window.location.href='/dashboard';
      }
    });
    document.addEventListener('click',function(e){if(!profile.contains(e.target))close();});
  }

  function watchForAccountMenu(){
    setupAccountMenu();
    if(window.MutationObserver){
      new MutationObserver(setupAccountMenu).observe(document.body,{childList:true,subtree:true});
    }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',watchForAccountMenu);
  else watchForAccountMenu();
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Script id="priorityos-workspace-fetch" strategy="beforeInteractive">{workspaceFetchPatch}</Script>
        {children}
        <footer className="site-footer">
          <span>© {new Date().getFullYear()} PriorityOS</span>
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
        </footer>
        <TaskNotesPatch />
      </body>
    </html>
  );
}
