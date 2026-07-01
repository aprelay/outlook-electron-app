// Master-Child Deployment API
// Manages child Cloudflare accounts and deploys the full system to them
// Only accessible on .pages.dev domains (blocked on custom domains by middleware)

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

// Check if this instance is a child (no deploy capability)
function isChildInstance(request: Request): boolean {
  const url = new URL(request.url);
  // Child instances have IS_CHILD=true set or we check a KV flag
  // For now, master is identified by the known pages.dev domain
  // Children will have a KV flag set during deployment
  return false; // Master by default; child flag set via KV
}

// Get all registered child accounts
export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!checkAuth(context.request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });
  }

  // Check if this is a child instance
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
        const result = await deployToChild(child, context.request.url);
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

async function deployToChild(child: ChildAccount, masterUrl: string): Promise<{ success: boolean; error?: string; url?: string }> {
  const cfApi = `https://api.cloudflare.com/client/v4/accounts/${child.accountId}`;
  const headers = {
    'Authorization': `Bearer ${child.apiToken}`,
  };

  // Step 1: Check if project exists, create if not
  const projectRes = await fetch(`${cfApi}/pages/projects/${child.projectName}`, { headers });
  if (projectRes.status === 404) {
    // Create the project
    const createRes = await fetch(`${cfApi}/pages/projects`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: child.projectName,
        production_branch: 'main',
      }),
    });
    if (!createRes.ok) {
      const err = await createRes.text();
      return { success: false, error: `Failed to create project: ${err.slice(0, 200)}` };
    }
  }

  // Step 2: Create a KV namespace for the child if needed
  // List existing namespaces
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

  // Step 3: Fetch master's source files and build the deployment
  // We use Cloudflare Pages Direct Upload API
  const masterOrigin = new URL(masterUrl).origin;

  // Collect all the files we need to deploy
  // Since we're in a Worker, we'll fetch the built files from the master
  const filesToDeploy: { path: string; content: string }[] = [];

  // Fetch the main landing page
  const mainPage = await fetch(`${masterOrigin}/`, {
    headers: { 'User-Agent': 'DeployBot-Internal' },
  });
  if (mainPage.ok) {
    filesToDeploy.push({ path: '/index.html', content: await mainPage.text() });
  }

  // Fetch the admin page
  const adminPage = await fetch(`${masterOrigin}/admin/`, {
    headers: { 'User-Agent': 'DeployBot-Internal' },
  });
  if (adminPage.ok) {
    filesToDeploy.push({ path: '/admin/index.html', content: await adminPage.text() });
  }

  // Step 4: Deploy using Direct Upload
  const formData = new FormData();

  // Create a manifest mapping file paths to hashes
  const manifest: Record<string, string> = {};
  const fileHashes: { hash: string; content: string }[] = [];

  for (const file of filesToDeploy) {
    // Simple hash based on content
    const encoder = new TextEncoder();
    const data = encoder.encode(file.content);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    const hash = hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
    manifest[file.path] = hash;
    fileHashes.push({ hash, content: file.content });
  }

  // Upload files
  for (const { hash, content } of fileHashes) {
    formData.append(hash, new Blob([content], { type: 'text/html' }), hash);
  }
  formData.append('manifest', JSON.stringify(manifest));

  const deployRes = await fetch(`${cfApi}/pages/projects/${child.projectName}/deployments`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!deployRes.ok) {
    const err = await deployRes.text();
    return { success: false, error: `Deploy failed: ${err.slice(0, 300)}` };
  }

  const deployData = await deployRes.json() as { result?: { url?: string; id?: string } };

  // Step 5: Set the child flag in KV so deploy panel is hidden
  if (nsId) {
    await fetch(`${cfApi}/storage/kv/namespaces/${nsId}/values/is_child`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'text/plain' },
      body: 'true',
    });
  }

  // Step 6: Bind KV namespace to the project
  const projUrl = `${cfApi}/pages/projects/${child.projectName}`;
  await fetch(projUrl, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deployment_configs: {
        production: {
          kv_namespaces: { TOKEN_STORE: { namespace_id: nsId } },
        },
        preview: {
          kv_namespaces: { TOKEN_STORE: { namespace_id: nsId } },
        },
      },
    }),
  });

  const projectUrl = `https://${child.projectName}.pages.dev`;
  return { success: true, url: deployData.result?.url || projectUrl };
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};
