import {execSync} from 'node:child_process';

const host = process.env.CAPACITOR_HOST ?? '10.0.2.2';
const port = process.env.PORT ?? '3000';
const url = `http://${host}:${port}/?local=1`;

console.log(`PriorityOS Capacitor development server: ${url}`);
console.log('Start Next.js separately with: npm run dev');

execSync(`npx cap sync android`, {
  stdio: 'inherit',
  env: {
    ...process.env,
    CAPACITOR_SERVER_URL: url,
  },
});
