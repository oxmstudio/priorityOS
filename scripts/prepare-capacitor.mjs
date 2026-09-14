import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';

const output = resolve('out/index.html');
await mkdir(dirname(output), {recursive: true});

await writeFile(
  output,
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>PriorityOS</title>
  </head>
  <body>
    <p>PriorityOS native shell is configured for the local Next.js development server.</p>
  </body>
</html>
`,
  'utf8'
);

console.log(`Prepared Capacitor webDir: ${output}`);
