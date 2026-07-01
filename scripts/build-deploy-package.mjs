#!/usr/bin/env node
// Builds a self-contained deploy package for the child deployment API.
// This pre-computes BLAKE3 hashes (matching wrangler's format) and bundles
// all assets + the _worker.bundle into a single JSON file served as a static asset.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { createHash } from 'blake3-wasm';

const distDir = path.resolve('dist/dashboard');

// Wrangler-compatible hash: blake3(base64(content) + extension).hex().slice(0, 32)
function hashFileContent(content, ext) {
  const base64Contents = content.toString('base64');
  const h = createHash();
  h.update(base64Contents + ext);
  return h.digest('hex').slice(0, 32);
}

// Recursively collect all files in dist/dashboard (excluding _worker_bundle.js and _deploy_package.json)
function collectFiles(dir, baseDir, results = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const relPath = '/' + path.relative(baseDir, fullPath);
    if (entry === '_worker_bundle.js' || entry === '_deploy_package.json' || entry === '_headers') continue;
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      collectFiles(fullPath, baseDir, results);
    } else {
      const content = readFileSync(fullPath);
      const ext = path.extname(fullPath).substring(1);
      const hash = hashFileContent(content, ext);

      // Determine content type
      const ctMap = {
        html: 'text/html',
        css: 'text/css',
        js: 'application/javascript',
        json: 'application/json',
        svg: 'image/svg+xml',
        png: 'image/png',
        ico: 'image/x-icon',
        woff: 'font/woff',
        woff2: 'font/woff2',
        ttf: 'font/ttf',
      };
      const contentType = ctMap[ext] || 'application/octet-stream';

      results.push({
        path: relPath,
        hash,
        contentType,
        base64: content.toString('base64'),
        size: content.length,
      });
    }
  }
  return results;
}

console.log('Collecting files from', distDir);
const files = collectFiles(distDir, distDir);
console.log(`Found ${files.length} files`);

// Build manifest (path -> hash)
const manifest = {};
for (const f of files) {
  manifest[f.path] = f.hash;
}

// Build _worker.bundle blob (nested multipart form: metadata + module)
const workerBundlePath = path.join(distDir, '_worker_bundle.js');
const workerJs = readFileSync(workerBundlePath, 'utf-8');

// We'll store the raw worker JS and let the deploy API build the multipart blob at runtime
// since the Workers runtime has FormData/Response available
const deployPackage = {
  version: 1,
  manifest,
  files: files.map(f => ({
    path: f.path,
    hash: f.hash,
    contentType: f.contentType,
    base64: f.base64,
  })),
  workerBundle: {
    content: Buffer.from(workerJs).toString('base64'),
    metadata: {
      main_module: 'index.js',
      compatibility_date: '2024-09-23',
      compatibility_flags: ['nodejs_compat'],
    },
  },
};

// Deduplicate files by hash for the upload payload
const uniqueFiles = [];
const seenHashes = new Set();
for (const f of deployPackage.files) {
  if (seenHashes.has(f.hash)) continue;
  seenHashes.add(f.hash);
  uniqueFiles.push({ key: f.hash, value: f.base64, metadata: { contentType: f.contentType }, base64: true });
}
deployPackage.uploadPayload = uniqueFiles;
deployPackage.uniqueHashes = [...seenHashes];

const output = path.join(distDir, 'deploy-package.json');
writeFileSync(output, JSON.stringify(deployPackage));
const size = statSync(output).size;
console.log(`Deploy package: ${output} (${(size / 1024).toFixed(1)} KB)`);
console.log(`  ${files.length} files, ${uniqueFiles.length} unique hashes`);
console.log('  Manifest:', JSON.stringify(manifest, null, 2));
