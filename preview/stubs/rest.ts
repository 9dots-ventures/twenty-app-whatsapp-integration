/**
 * Preview stub for `twenty-client-sdk/rest`.
 *
 * Fakes `GET /s/whatsapp/config` so the component renders without a Twenty
 * server. Behaviour is driven by URL query params — see preview/README.md.
 *
 *   ?state=ok|loading|error   default ok
 *   ?connections=2            starting connection count (default 0)
 *   ?delay=800                ms before the first config response (default 400)
 *   ?autoconnect=6            seconds after Connect until a connection appears
 *                             (default 6; use 0 to never resolve → timeout path)
 */

const params = new URLSearchParams(window.location.search);
const num = (key: string, fallback: number): number => {
  const raw = params.get(key);
  const parsed = raw === null ? NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const state = params.get('state') ?? 'ok';
const delay = num('delay', 400);
const autoconnectSeconds = num('autoconnect', 6);

const SIGNUP_SERVER_URL = 'https://whatsapp-embeddedsignup.onrender.com';

let connectionCount = num('connections', 0);
let connectClickedAt: number | null = null;

const makeConnections = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `preview-connection-${i + 1}`,
    name: `Preview Business ${i + 1} — 1000000000000${i}`,
    wabaId: `1000000000000${i}`,
    phoneNumber: `+1 415 555 010${i + 1}`,
    businessName: `Preview Business ${i + 1}`,
    status: 'CONNECTED',
  }));

// The component opens the signup window with window.open. Intercept it so the
// preview does not actually navigate to Meta, and use it as the trigger for the
// simulated "connection arrived" event that the poll loop is waiting for.
const nativeOpen = window.open.bind(window);
window.open = ((url?: string | URL, target?: string, features?: string) => {
  connectClickedAt = Date.now();
  // eslint-disable-next-line no-console
  console.info('[preview] window.open intercepted →', String(url));

  if (params.get('popup') === 'real') {
    return nativeOpen(url, target, features);
  }
  if (params.get('popup') === 'blocked') {
    return null;
  }
  // Return a stub window object: truthy, so the component proceeds to polling.
  return { closed: false, close: () => {}, focus: () => {} } as unknown as Window;
}) as typeof window.open;

export class RestApiClient {
  async get(path: string): Promise<unknown> {
    await new Promise((r) => setTimeout(r, delay));

    if (path !== '/s/whatsapp/config') {
      throw new Error(`[preview] unmocked path: ${path}`);
    }
    if (state === 'error') {
      throw new Error('[preview] simulated config failure');
    }
    if (state === 'loading') {
      // Never resolves — exercises the loading spinner.
      await new Promise(() => {});
    }

    if (
      connectClickedAt !== null &&
      autoconnectSeconds > 0 &&
      Date.now() - connectClickedAt >= autoconnectSeconds * 1000
    ) {
      connectionCount += 1;
      connectClickedAt = null;
    }

    return {
      signupServerUrl: SIGNUP_SERVER_URL,
      twentyBaseUrl: window.location.origin,
      connections: makeConnections(connectionCount),
    };
  }

  async post(path: string, body: unknown): Promise<unknown> {
    // eslint-disable-next-line no-console
    console.info('[preview] POST', path, body);
    return { success: true };
  }
}

export default { RestApiClient };
