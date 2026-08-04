import { cp, mkdir } from 'node:fs/promises';

await mkdir('dist/account', { recursive: true });
await Promise.all([
  cp('src/account/index.html', 'dist/account/index.html'),
  cp('src/account/styles.css', 'dist/account/styles.css'),
]);
