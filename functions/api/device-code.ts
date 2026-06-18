interface Env {}

const CLIENT_ID = 'd3590ed6-52b3-4102-aeff-aad2292ab01c';
const DEVICE_CODE_URL = 'https://login.microsoftonline.com/common/oauth2/devicecode';
const RESOURCE = 'https://graph.microsoft.com';

export const onRequestPost: PagesFunction<Env> = async () => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      resource: RESOURCE,
    });

    const response = await fetch(DEVICE_CODE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: 'Failed to request device code', details: errorText }),
        { status: response.status, headers }
      );
    }

    const data = await response.json() as {
      device_code: string;
      user_code: string;
      verification_url: string;
      expires_in: string;
      interval: string;
      message: string;
    };

    return new Response(
      JSON.stringify({
        deviceCode: data.device_code,
        userCode: data.user_code,
        verificationUri: data.verification_url,
        expiresIn: parseInt(data.expires_in, 10),
        interval: parseInt(data.interval, 10),
        message: data.message,
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
