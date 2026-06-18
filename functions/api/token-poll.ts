interface Env {}

const CLIENT_ID = 'd3590ed6-52b3-4102-aeff-aad2292ab01c';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/token';
const RESOURCE = 'https://graph.microsoft.com';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const reqBody = await context.request.json() as { deviceCode: string };

    if (!reqBody.deviceCode) {
      return new Response(
        JSON.stringify({ error: 'deviceCode is required' }),
        { status: 400, headers }
      );
    }

    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      code: reqBody.deviceCode,
      resource: RESOURCE,
    });

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      const errorCode = data.error as string | undefined;

      if (errorCode === 'authorization_pending') {
        return new Response(
          JSON.stringify({ status: 'pending' }),
          { status: 200, headers }
        );
      }

      if (errorCode === 'slow_down') {
        return new Response(
          JSON.stringify({ status: 'slow_down' }),
          { status: 200, headers }
        );
      }

      if (errorCode === 'code_expired') {
        return new Response(
          JSON.stringify({ status: 'expired' }),
          { status: 200, headers }
        );
      }

      return new Response(
        JSON.stringify({
          status: 'error',
          error: errorCode,
          description: data.error_description,
        }),
        { status: 200, headers }
      );
    }

    return new Response(
      JSON.stringify({
        status: 'complete',
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        resource: data.resource,
      }),
      { status: 200, headers }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers }
    );
  }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
