interface Env {}

const CLIENT_ID = '04b07795-a710-4e83-87bc-c9a5060bcee3';
const DEVICE_CODE_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/devicecode';
const SCOPES = 'openid profile offline_access User.Read Mail.Read Mail.ReadWrite Mail.Send MailboxSettings.Read';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      scope: SCOPES,
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
      verification_uri: string;
      expires_in: number;
      interval: number;
      message: string;
    };

    return new Response(
      JSON.stringify({
        deviceCode: data.device_code,
        userCode: data.user_code,
        verificationUri: data.verification_uri,
        expiresIn: data.expires_in,
        interval: data.interval,
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
