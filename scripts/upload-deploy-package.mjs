#!/usr/bin/env node
// Uploads the deploy package to KV so the deploy API can read it
// Run after `wrangler pages deploy`

import { readFileSync } from 'fs';
import path from 'path';

const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || 'ed1d03ccd01dfae6cff6aa83318c9110';
const KV_NAMESPACE_ID = '7ba4dd32c6b14a979b769d1395b224e2'; // TOKEN_STORE

if (!CF_API_TOKEN) {
  console.error('CLOUDFLARE_API_TOKEN is required');
  process.exit(1);
}

const pkgPath = path.resolve('dist/dashboard/deploy-package.json');
const pkg = readFileSync(pkgPath, 'utf-8');
console.log(`Deploy package: ${(Buffer.byteLength(pkg) / 1024).toFixed(1)} KB`);

// Upload to KV
const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/deploy_package`;
const res = await fetch(url, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${CF_API_TOKEN}`,
    'Content-Type': 'application/octet-stream',
  },
  body: pkg,
});

const result = await res.json();
if (result.success) {
  console.log('Deploy package uploaded to KV successfully');
} else {
  console.error('Failed to upload deploy package:', JSON.stringify(result.errors));
  process.exit(1);
}
