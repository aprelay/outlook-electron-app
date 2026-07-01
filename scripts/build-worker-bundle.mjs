// Builds the _worker.bundle blob in the format Cloudflare Pages API expects
// This is a nested multipart form data containing metadata + the worker module
import { readFileSync, writeFileSync } from 'fs';

const workerJs = readFileSync('dist/dashboard/_worker_bundle.js', 'utf-8');

// Create the inner FormData (same as createWorkerUploadForm)
const innerForm = new FormData();

const metadata = {
  main_module: 'index.js',
  compatibility_date: '2024-09-23',
  compatibility_flags: ['nodejs_compat'],
};
innerForm.append('metadata', JSON.stringify(metadata));
innerForm.append(
  'index.js',
  new File([workerJs], 'index.js', { type: 'application/javascript+module' })
);

// Serialize to blob (this is what wrangler does: new Response(formData).blob())
const response = new Response(innerForm);
const blob = await response.blob();
const buffer = Buffer.from(await blob.arrayBuffer());

writeFileSync('dist/dashboard/_worker_bundle_blob', buffer);
console.log(`Built _worker.bundle blob: ${buffer.length} bytes`);
console.log(`Content-Type: ${response.headers.get('content-type')}`);
