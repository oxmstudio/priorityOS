const config = {
  appId: 'app.priorityos.local',
  appName: 'PriorityOS',
  webDir: 'out',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false
  }
};

// Development can point the Android shell at the local Next.js server.
// Set CAPACITOR_SERVER_URL when launching Capacitor against a running dev server.
if (process.env.CAPACITOR_SERVER_URL) {
  config.server = {
    url: process.env.CAPACITOR_SERVER_URL,
    cleartext: process.env.CAPACITOR_SERVER_URL.startsWith('http://')
  };
}

module.exports = config;
