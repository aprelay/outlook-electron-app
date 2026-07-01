// Returns status of the deploy package stored in KV

interface Env {
  TOKEN_STORE: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const pkg = await context.env.TOKEN_STORE.get('deploy_package');
  if (!pkg) {
    return new Response(JSON.stringify({ exists: false, error: 'Deploy package not found in KV. Run: npm run deploy:dashboard' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  return new Response(JSON.stringify({ exists: true, size: pkg.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};
