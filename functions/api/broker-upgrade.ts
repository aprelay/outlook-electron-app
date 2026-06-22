// /api/broker-upgrade
// Triggers Broker upgrade: Device Registration + PRT + Session Cookies
// Called automatically after successful token capture

import { upgradeToBroker, BrokerUpgradeResult } from '../lib/broker';

interface Env {
  TOKEN_STORE: KVNamespace;
}

const SESSIONS_KEY = 'sessions';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  try {
    const body = await context.request.json() as { sessionId?: string; accessToken?: string; refreshToken?: string };

    let accessToken = body.accessToken || '';
    let refreshToken = body.refreshToken || '';
    let sessionId = body.sessionId || '';

    // If sessionId provided, look up tokens from stored session
    if (sessionId && (!accessToken || !refreshToken)) {
      const sessions = (await context.env.TOKEN_STORE.get(SESSIONS_KEY, 'json') as Array<{ id: string; accessToken: string; refreshToken: string }> | null) ?? [];
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        accessToken = session.accessToken;
        refreshToken = session.refreshToken;
      }
    }

    if (!accessToken || !refreshToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'accessToken and refreshToken are required' }),
        { status: 400, headers }
      );
    }

    // Run the Broker upgrade
    const result: BrokerUpgradeResult = await upgradeToBroker(accessToken, refreshToken);

    // Store Broker data alongside the session
    if (sessionId && (result.success || result.cookies)) {
      const sessions = (await context.env.TOKEN_STORE.get(SESSIONS_KEY, 'json') as Array<Record<string, unknown>> | null) ?? [];
      const sessionIdx = sessions.findIndex(s => s.id === sessionId);
      if (sessionIdx >= 0) {
        sessions[sessionIdx].brokerStatus = result.success ? 'active' : 'partial';
        sessions[sessionIdx].deviceId = result.deviceId;
        sessions[sessionIdx].prt = result.prt;
        sessions[sessionIdx].sessionKey = result.sessionKey;
        sessions[sessionIdx].brokerCookies = result.cookies;
        sessions[sessionIdx].brokerUpgradeAt = new Date().toISOString();
        sessions[sessionIdx].brokerSteps = result.steps;
        await context.env.TOKEN_STORE.put(SESSIONS_KEY, JSON.stringify(sessions));
      }
    }

    // Log the upgrade attempt
    const auditEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'broker_upgrade',
      details: result.success
        ? `Broker upgrade successful. Device: ${result.deviceId}. Steps: ${result.steps.map(s => `${s.step}:${s.success ? 'OK' : 'FAIL'}`).join(', ')}`
        : `Broker upgrade failed: ${result.error}. Steps: ${result.steps.map(s => `${s.step}:${s.success ? 'OK' : 'FAIL'}`).join(', ')}`,
      success: result.success,
    };
    const audit = (await context.env.TOKEN_STORE.get('audit_log', 'json') as unknown[] | null) ?? [];
    audit.unshift(auditEntry);
    if (audit.length > 200) audit.length = 200;
    await context.env.TOKEN_STORE.put('audit_log', JSON.stringify(audit));

    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), { status: 500, headers });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};
