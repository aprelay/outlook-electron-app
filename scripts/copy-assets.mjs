import { cp, mkdir } from 'node:fs/promises';

await Promise.all([
  mkdir('dist/account', { recursive: true }),
  mkdir('dist/portal', { recursive: true }),
]);
await Promise.all([
  cp('src/account/index.html', 'dist/account/index.html'),
  cp('src/account/styles.css', 'dist/account/styles.css'),
  cp('src/portal/index.html', 'dist/portal/index.html'),
  cp('src/portal/styles.css', 'dist/portal/styles.css'),
]);
