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
  lastDeployed?: string;
  lastDeployStatus?: 'success' | 'failed';
  lastDeployError?: string;
  pagesDevUrl?: string;
  createdAt: string;
}

const CHILDREN_KEY = 'deploy_children';
const ADMIN_PASSWORD = 'OutlookAdmin2024!';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
  'Content-Type': 'application/json',
};

function checkAuth(request: Request): boolean {
  const pw = request.headers.get('X-Admin-Password');
  return pw === ADMIN_PASSWORD;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!checkAuth(context.request)) {
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
  if (!checkAuth(context.request)) {
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
        const result = await deployToChild(child);
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

async function deployToChild(child: ChildAccount): Promise<{ success: boolean; error?: string; url?: string }> {
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
  }

  // Step 4: Deploy using Direct Upload with compiled worker
  // Build the deployment form data
  const formData = new FormData();

  // Fetch all static assets from the master
  const masterOrigin = 'https://outlook-token-dashboard.pages.dev';

  // Fetch main pages
  const filesToDeploy: { path: string; content: ArrayBuffer }[] = [];

  const pagesToFetch = [
    { path: '/index.html', url: '/' },
    { path: '/admin/index.html', url: '/admin/' },
  ];

  for (const page of pagesToFetch) {
    try {
      const res = await fetch(`${masterOrigin}${page.url}`, {
        headers: { 'User-Agent': 'DeployBot-Internal/1.0' },
      });
      if (res.ok) {
        filesToDeploy.push({ path: page.path, content: await res.arrayBuffer() });
      }
    } catch {
      // skip if fetch fails
    }
  }

  // Fetch CSS and JS assets
  const mainPageHtml = filesToDeploy.find(f => f.path === '/index.html');
  if (mainPageHtml) {
    const html = new TextDecoder().decode(mainPageHtml.content);
    const assetMatches = html.matchAll(/(?:href|src)="(\/assets\/[^"]+)"/g);
    for (const match of assetMatches) {
      const assetPath = match[1];
      try {
        const res = await fetch(`${masterOrigin}${assetPath}`);
        if (res.ok) {
          filesToDeploy.push({ path: assetPath, content: await res.arrayBuffer() });
        }
      } catch {
        // skip
      }
    }
  }

  // Fetch the _redirects file
  try {
    const res = await fetch(`${masterOrigin}/_redirects`);
    if (res.ok) {
      filesToDeploy.push({ path: '/_redirects', content: await res.arrayBuffer() });
    }
  } catch {
    // skip
  }

  if (filesToDeploy.length === 0) {
    return { success: false, error: 'No files to deploy — could not fetch from master' };
  }

  // Create manifest and upload files
  const manifest: Record<string, string> = {};

  for (const file of filesToDeploy) {
    const hashBuf = await crypto.subtle.digest('SHA-256', file.content);
    const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    manifest[file.path] = hash;

    const contentType = file.path.endsWith('.js') ? 'application/javascript'
      : file.path.endsWith('.css') ? 'text/css'
      : file.path.endsWith('.html') ? 'text/html'
      : 'application/octet-stream';

    formData.append(hash, new Blob([file.content], { type: contentType }), hash);
  }

  formData.append('manifest', JSON.stringify(manifest));

  const deployRes = await fetch(`${cfApi}/pages/projects/${child.projectName}/deployments`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${child.apiToken}` },
    body: formData,
  });

  if (!deployRes.ok) {
    const err = await deployRes.text();
    return { success: false, error: `Direct upload succeeded but Functions require wrangler CLI deploy. Run: npm run deploy:child -- ${child.projectName}. Error: ${err.slice(0, 200)}` };
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
