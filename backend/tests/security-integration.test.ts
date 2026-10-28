import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app';
import { env } from '../src/config/env';
import type { AddressInfo } from 'node:net';

let baseUrl: string;
let server: ReturnType<typeof app.listen>;

test.before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('OAuth route returns 503 when credentials are not configured, or redirects when configured', async () => {
  const res = await fetch(`${baseUrl}/auth/google`, { redirect: 'manual' });
  const credentialsSet = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  if (credentialsSet) {
    // With real credentials, the route redirects to Google OAuth consent screen
    assert.ok(
      res.status === 302 || res.status === 200,
      `Expected redirect (302) or 200 when credentials are configured, got ${res.status}`
    );
  } else {
    assert.equal(res.status, 503);
    const data = await res.json();
    assert.match(data.error, /Gmail OAuth is not configured/);
  }
});

test('OAuth callback rejects missing state and cookie', async () => {
  const res = await fetch(`${baseUrl}/auth/google/callback`);
  assert.equal(res.status, 400);
  const body = await res.text();
  assert.match(body, /OAuth state validation failed/);
});

test('OAuth callback rejects state cookie mismatch', async () => {
  const res = await fetch(`${baseUrl}/auth/google/callback?state=state_from_url`, {
    headers: {
      cookie: 'gmail_oauth_state=different_cookie_state'
    }
  });
  assert.equal(res.status, 400);
  const body = await res.text();
  assert.match(body, /OAuth state validation failed/);
});

test('Pub/Sub webhook returns 503 when push token is not configured', async () => {
  const origToken = env.PUBSUB_PUSH_TOKEN;
  (env as { PUBSUB_PUSH_TOKEN: string }).PUBSUB_PUSH_TOKEN = '';
  try {
    const res = await fetch(`${baseUrl}/webhooks/gmail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { data: 'test' } })
    });
    assert.equal(res.status, 503);
    const data = await res.json();
    assert.match(data.error, /Pub\/Sub webhook is not configured/);
  } finally {
    (env as { PUBSUB_PUSH_TOKEN: string }).PUBSUB_PUSH_TOKEN = origToken;
  }
});

test('Pub/Sub webhook rejects invalid bearer token with 401', async () => {
  const origToken = env.PUBSUB_PUSH_TOKEN;
  (env as { PUBSUB_PUSH_TOKEN: string }).PUBSUB_PUSH_TOKEN = 'secret-token-12345';
  try {
    const res = await fetch(`${baseUrl}/webhooks/gmail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer wrong-token'
      },
      body: JSON.stringify({ message: { data: 'test', messageId: '1' } })
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.match(data.error, /Invalid Pub\/Sub delivery token/);
  } finally {
    (env as { PUBSUB_PUSH_TOKEN: string }).PUBSUB_PUSH_TOKEN = origToken;
  }
});

test('Pub/Sub webhook rejects malformed envelope missing messageId or data with 400', async () => {
  const origToken = env.PUBSUB_PUSH_TOKEN;
  (env as { PUBSUB_PUSH_TOKEN: string }).PUBSUB_PUSH_TOKEN = 'test-token-12345';
  try {
    const res = await fetch(`${baseUrl}/webhooks/gmail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token-12345'
      },
      body: JSON.stringify({ message: { messageId: 'msg-1' } }) // missing data
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /Invalid Pub\/Sub envelope/);
  } finally {
    (env as { PUBSUB_PUSH_TOKEN: string }).PUBSUB_PUSH_TOKEN = origToken;
  }
});

test('Pub/Sub webhook accepts valid token and valid envelope with 204 No Content', async () => {
  const origToken = env.PUBSUB_PUSH_TOKEN;
  (env as { PUBSUB_PUSH_TOKEN: string }).PUBSUB_PUSH_TOKEN = 'valid-token-12345';
  try {
    const payload = Buffer.from(JSON.stringify({ emailAddress: 'user@example.com', historyId: '12345' })).toString('base64');
    const res = await fetch(`${baseUrl}/webhooks/gmail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token-12345'
      },
      body: JSON.stringify({
        message: {
          data: payload,
          messageId: 'pubsub-msg-1'
        }
      })
    });
    assert.equal(res.status, 204);
  } finally {
    (env as { PUBSUB_PUSH_TOKEN: string }).PUBSUB_PUSH_TOKEN = origToken;
  }
});

test('CSV upload endpoint validates missing body with 400', async () => {
  const resEmpty = await fetch(`${baseUrl}/api/messages/upload-csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  assert.equal(resEmpty.status, 400);
});
