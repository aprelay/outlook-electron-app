// Master-Child Deployment API
// Manages child Cloudflare accounts and coordinates deployments
// Actual file deployment is done via wrangler CLI (triggered by deploy_child/deploy_all)

interface Env {
  TOKEN_STORE: KVNamespace;
}

interface ChildAccount {
  id: string;
  name: string;
  accountId: string;
  apiToken: string;
  projectName: string;
  adminPassword?: string;
  lastDeployed?: string;
  lastDeployStatus?: 'success' | 'failed';
  lastDeployError?: string;
  pagesDevUrl?: string;
  createdAt: string;
}

const CHILDREN_KEY = 'deploy_children';
const DEFAULT_ADMIN_PASSWORD = 'OutlookAdmin2024!';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
  'Content-Type': 'application/json',
};

async function checkAuth(request: Request, kv: KVNamespace): Promise<boolean> {
  const pw = request.headers.get('X-Admin-Password');
  const adminPw = (await kv.get('admin_password')) || DEFAULT_ADMIN_PASSWORD;
  return pw === adminPw;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!(await checkAuth(context.request, context.env.TOKEN_STORE))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });
  }

  const isChild = await context.env.TOKEN_STORE.get('is_child');
  if (isChild === 'true') {
    return new Response(JSON.stringify({ error: 'Deploy not available on child instances' }), { status: 403, headers: CORS_HEADERS });
  }

  const children = await context.env.TOKEN_STORE.get(CHILDREN_KEY, 'json') as ChildAccount[] | null;
  return new Response(JSON.stringify({ children: children ?? [] }), { status: 200, headers: CORS_HEADERS });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!(await checkAuth(context.request, context.env.TOKEN_STORE))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });
  }

  const isChild = await context.env.TOKEN_STORE.get('is_child');
  if (isChild === 'true') {
    return new Response(JSON.stringify({ error: 'Deploy not available on child instances' }), { status: 403, headers: CORS_HEADERS });
  }

  const body = await context.request.json() as {
    action: string;
    child?: Partial<ChildAccount>;
    childId?: string;
  };

  const children = (await context.env.TOKEN_STORE.get(CHILDREN_KEY, 'json') as ChildAccount[] | null) ?? [];

  if (body.action === 'add_child') {
    if (!body.child?.name || !body.child?.accountId || !body.child?.apiToken || !body.child?.projectName) {
      return new Response(JSON.stringify({ error: 'Missing required fields: name, accountId, apiToken, projectName' }), { status: 400, headers: CORS_HEADERS });
    }
    if (!body.child.adminPassword) {
      return new Response(JSON.stringify({ error: 'Admin password is required for child instance' }), { status: 400, headers: CORS_HEADERS });
    }

    // Verify the Cloudflare API token works
    const verifyRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${body.child.accountId}/pages/projects`, {
      headers: { 'Authorization': `Bearer ${body.child.apiToken}` },
    });
    if (!verifyRes.ok) {
      return new Response(JSON.stringify({ error: 'Invalid Cloudflare credentials — could not list projects' }), { status: 400, headers: CORS_HEADERS });
    }

    const newChild: ChildAccount = {
      id: `child_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: body.child.name,
      accountId: body.child.accountId,
      apiToken: body.child.apiToken,
      projectName: body.child.projectName,
      adminPassword: body.child.adminPassword,
      createdAt: new Date().toISOString(),
    };

    children.push(newChild);
    await context.env.TOKEN_STORE.put(CHILDREN_KEY, JSON.stringify(children));

    return new Response(JSON.stringify({ success: true, child: { ...newChild, apiToken: '***' } }), { status: 200, headers: CORS_HEADERS });
  }

  if (body.action === 'remove_child') {
    const updated = children.filter(c => c.id !== body.childId);
    await context.env.TOKEN_STORE.put(CHILDREN_KEY, JSON.stringify(updated));
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS_HEADERS });
  }

  if (body.action === 'deploy_child' || body.action === 'deploy_all') {
    const targets = body.action === 'deploy_all' ? children : children.filter(c => c.id === body.childId);
    if (targets.length === 0) {
      return new Response(JSON.stringify({ error: 'No targets found' }), { status: 404, headers: CORS_HEADERS });
    }

    const results: { childId: string; name: string; success: boolean; error?: string; url?: string }[] = [];

    for (const child of targets) {
      try {
        const result = await deployToChild(child, context.env.TOKEN_STORE);
        child.lastDeployed = new Date().toISOString();
        child.lastDeployStatus = result.success ? 'success' : 'failed';
        child.lastDeployError = result.error;
        child.pagesDevUrl = result.url || child.pagesDevUrl;
        results.push({ childId: child.id, name: child.name, success: result.success, error: result.error, url: result.url });
      } catch (e) {
        const err = e instanceof Error ? e.message : 'Unknown error';
        child.lastDeployed = new Date().toISOString();
        child.lastDeployStatus = 'failed';
        child.lastDeployError = err;
        results.push({ childId: child.id, name: child.name, success: false, error: err });
      }
    }

    await context.env.TOKEN_STORE.put(CHILDREN_KEY, JSON.stringify(children));
    return new Response(JSON.stringify({ success: true, results }), { status: 200, headers: CORS_HEADERS });
  }

  if (body.action === 'test_connection') {
    const child = children.find(c => c.id === body.childId);
    if (!child) {
      return new Response(JSON.stringify({ error: 'Child not found' }), { status: 404, headers: CORS_HEADERS });
    }

    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${child.accountId}/pages/projects`, {
        headers: { 'Authorization': `Bearer ${child.apiToken}` },
      });
      const data = await res.json() as { success: boolean; result?: { name: string }[] };
      const projects = data.result?.map(p => p.name) || [];
      return new Response(JSON.stringify({ success: data.success, projects }), { status: 200, headers: CORS_HEADERS });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Connection failed' }), { status: 200, headers: CORS_HEADERS });
    }
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: CORS_HEADERS });
};

async function deployToChild(child: ChildAccount, kvStore: KVNamespace): Promise<{ success: boolean; error?: string; url?: string }> {
  const cfApi = `https://api.cloudflare.com/client/v4/accounts/${child.accountId}`;
  const headers = { 'Authorization': `Bearer ${child.apiToken}` };

  // Step 1: Ensure project exists
  const projectRes = await fetch(`${cfApi}/pages/projects/${child.projectName}`, { headers });
  if (projectRes.status === 404) {
    const createRes = await fetch(`${cfApi}/pages/projects`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: child.projectName, production_branch: 'main' }),
    });
    if (!createRes.ok) {
      const err = await createRes.text();
      return { success: false, error: `Failed to create project: ${err.slice(0, 200)}` };
    }
  }

  // Step 2: Ensure KV namespace exists
  const nsRes = await fetch(`${cfApi}/storage/kv/namespaces?per_page=100`, { headers });
  const nsData = await nsRes.json() as { result?: { id: string; title: string }[] };
  const nsName = `${child.projectName}_TOKEN_STORE`;
  let nsId = nsData.result?.find(n => n.title === nsName)?.id;

  if (!nsId) {
    const createNs = await fetch(`${cfApi}/storage/kv/namespaces`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: nsName }),
    });
    const nsResult = await createNs.json() as { result?: { id: string } };
    nsId = nsResult.result?.id;
  }

  // Step 3: Bind KV to project
  if (nsId) {
    await fetch(`${cfApi}/pages/projects/${child.projectName}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_configs: {
          production: { kv_namespaces: { TOKEN_STORE: { namespace_id: nsId } } },
          preview: { kv_namespaces: { TOKEN_STORE: { namespace_id: nsId } } },
        },
      }),
    });

    // Set is_child flag
    await fetch(`${cfApi}/storage/kv/namespaces/${nsId}/values/is_child`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'text/plain' },
      body: 'true',
    });

    // Set child admin password in KV
    if (child.adminPassword) {
      await fetch(`${cfApi}/storage/kv/namespaces/${nsId}/values/admin_password`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'text/plain' },
        body: child.adminPassword,
      });
    }
  }

  // Step 4: Deploy using pre-built deploy package from KV
  // The deploy package contains pre-computed BLAKE3 hashes (matching wrangler),
  // base64-encoded file contents, and worker bundle metadata.

  interface DeployFile { path: string; hash: string; contentType: string; base64: string }
  interface UploadEntry { key: string; value: string; metadata: { contentType: string }; base64: true }
  interface DeployPackage {
    manifest: Record<string, string>;
    files: DeployFile[];
    workerBundle: { content: string; metadata: { main_module: string; compatibility_date: string; compatibility_flags?: string[] } };
    uploadPayload: UploadEntry[];
    uniqueHashes: string[];
  }

  // Read deploy package from master's KV
  const pkgStr = await kvStore.get('deploy_package');
  if (!pkgStr) {
    return { success: false, error: 'Deploy package not found in KV. Run upload-deploy-package script after building.' };
  }

  const pkg = JSON.parse(pkgStr) as DeployPackage;

  if (!pkg.manifest || !pkg.workerBundle || !pkg.uploadPayload) {
    return { success: false, error: 'Invalid deploy package format' };
  }

  // Step 4a: Get upload token (JWT) for asset upload
  const tokenRes = await fetch(`${cfApi}/pages/projects/${child.projectName}/upload-token`, { headers });
  if (!tokenRes.ok) {
    return { success: false, error: 'Failed to get upload token from child account' };
  }
  const tokenData = await tokenRes.json() as { result?: { jwt: string } };
  const jwt = tokenData.result?.jwt;
  if (!jwt) {
    return { success: false, error: 'No JWT in upload token response' };
  }

  // Step 4b: Check which assets are missing
  const checkRes = await fetch('https://api.cloudflare.com/client/v4/pages/assets/check-missing', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ hashes: pkg.uniqueHashes }),
  });

  let missingHashes: string[] = pkg.uniqueHashes;
  if (checkRes.ok) {
    const checkData = await checkRes.json() as { result?: string[] };
    missingHashes = checkData.result ?? pkg.uniqueHashes;
  }

  // Step 4c: Upload missing assets via /pages/assets/upload (JSON with base64)
  if (missingHashes.length > 0) {
    const toUpload = pkg.uploadPayload.filter(f => missingHashes.includes(f.key));
    if (toUpload.length > 0) {
      const uploadRes = await fetch('https://api.cloudflare.com/client/v4/pages/assets/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(toUpload),
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.text();
        return { success: false, error: `Asset upload failed: ${err.slice(0, 200)}` };
      }
    }
  }

  // Step 4d: Finalize hashes
  await fetch('https://api.cloudflare.com/client/v4/pages/assets/upsert-hashes', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ hashes: pkg.uniqueHashes }),
  });

  // Step 4e: Build _worker.bundle (nested multipart form: metadata + module)
  const workerContent = Uint8Array.from(atob(pkg.workerBundle.content), c => c.charCodeAt(0));

  // Build the inner multipart form for the worker bundle manually
  const boundary = '----WorkerBundleBoundary' + Date.now();
  const metadataJson = JSON.stringify(pkg.workerBundle.metadata);

  // Construct multipart body manually for precise control
  const parts: string[] = [];
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="metadata"; filename="metadata"\r\nContent-Type: application/json\r\n\r\n${metadataJson}\r\n`);

  const prefix = `--${boundary}\r\nContent-Disposition: form-data; name="index.js"; filename="index.js"\r\nContent-Type: application/javascript+module\r\n\r\n`;
  const suffix = `\r\n--${boundary}--\r\n`;

  const encoder = new TextEncoder();
  const prefixBytes = encoder.encode(parts[0] + prefix);
  const suffixBytes = encoder.encode(suffix);

  const bundleBody = new Uint8Array(prefixBytes.length + workerContent.length + suffixBytes.length);
  bundleBody.set(prefixBytes, 0);
  bundleBody.set(workerContent, prefixBytes.length);
  bundleBody.set(suffixBytes, prefixBytes.length + workerContent.length);

  const bundleBlob = new Blob([bundleBody], { type: `multipart/form-data; boundary=${boundary}` });

  // Step 4f: Create deployment with manifest + _worker.bundle
  const deployForm = new FormData();
  deployForm.append('manifest', JSON.stringify(pkg.manifest));
  deployForm.append('branch', 'main');
  deployForm.append('_worker.bundle', bundleBlob, '_worker.bundle');

  const deployUrl = `${cfApi}/pages/projects/${child.projectName}/deployments`;
  let deployRes = await fetch(deployUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${child.apiToken}` },
    body: deployForm,
  });

  // If auth fails, try with the JWT token instead
  if (!deployRes.ok) {
    const errText = await deployRes.text();
    // Try with JWT as backup
    const retryForm = new FormData();
    retryForm.append('manifest', JSON.stringify(pkg.manifest));
    retryForm.append('branch', 'main');
    retryForm.append('_worker.bundle', bundleBlob, '_worker.bundle');

    deployRes = await fetch(deployUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${jwt}` },
      body: retryForm,
    });

    if (!deployRes.ok) {
      const err2 = await deployRes.text();
      return { success: false, error: `Deploy failed with both tokens. Token err: ${errText.slice(0, 150)}. JWT err: ${err2.slice(0, 150)}` };
    }
  }

  const deployData = await deployRes.json() as { result?: { url?: string } };
  const projectUrl = `https://${child.projectName}.pages.dev`;

  return {
    success: true,
    url: deployData.result?.url || projectUrl,
  };
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};
