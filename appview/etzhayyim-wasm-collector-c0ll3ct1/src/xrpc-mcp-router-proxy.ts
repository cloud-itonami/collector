// PROVENANCE: moved byte-identical from
// `svelte/src/routes/xrpc/[...path]/+server.ts` during the Svelte -> ClojureScript
// migration (agent/cljs-migration, see appview/etzhayyim-wasm-collector-c0ll3ct1/cljs/).
// This is a SvelteKit server route handler, not a plain Cloudflare Worker module:
// it imports `@sveltejs/kit` and the SvelteKit-generated `./$types`, and it was only
// reachable because `wrangler.jsonc`'s `main` deployed the SvelteKit build
// (`svelte/.svelte-kit/cloudflare/_worker.js`), which routed POST /xrpc/{path} here.
// Now that `svelte/` has been deleted, this file WILL NOT RUN AS-IS: the SvelteKit
// build no longer exists, `./$types` cannot be generated, and nothing wires this
// handler into a request path. It is preserved verbatim (not deleted, not rewritten)
// because it is a real HTTP backend behavior (POST /xrpc/{nsid} -> forwards to the
// MCP router as a `tools/call` JSON-RPC request, unwraps `structuredContent`, no-store
// caching, permissive CORS OPTIONS), and reviving it — e.g. porting it to a plain
// `ExportedHandler<Env>` alongside `src/app.ts`, or wiring it through the
// `assets.directory` Worker mentioned in `wrangler.jsonc` — is a product decision for
// a human/operator, not something this migration agent decides.
//
// Original content follows unmodified below this header.

import { json, type RequestEvent } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const DEFAULT_MCP_ROUTER_URL = 'https://mcp.etzhayyim.com/xrpc/com.etzhayyim.mcp.message';

type Env = Record<string, unknown> & { AGENTGATEWAY_MCP_ROUTER_URL?: string; MCP_ROUTER_URL?: string };

function envOf(event: RequestEvent): Env { return ((event.platform as { env?: Env } | undefined)?.env ?? {}) as Env; }

function mcpRouterUrl(env: Env): string {
  const configured = typeof env.AGENTGATEWAY_MCP_ROUTER_URL === 'string' && env.AGENTGATEWAY_MCP_ROUTER_URL.trim()
    ? env.AGENTGATEWAY_MCP_ROUTER_URL
    : typeof env.MCP_ROUTER_URL === 'string' && env.MCP_ROUTER_URL.trim()
      ? env.MCP_ROUTER_URL
      : DEFAULT_MCP_ROUTER_URL;
  return configured.replace(/\/+$/, '');
}

function noStore(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('cache-control', 'no-store');
  return json(body, { ...init, headers });
}

export const POST: RequestHandler = async (event) => {
  const nsid = event.params.path;
  if (!nsid) return noStore({ error: 'Missing XRPC method' }, { status: 400 });
  const input = await event.request.json().catch(() => ({}));
  const headers = new Headers(event.request.headers);
  headers.delete('host');
  headers.set('content-type', 'application/json');
  headers.set('x-etzhayyim-bff', 'sveltekit-edge-bff');
  headers.set('x-etzhayyim-xrpc-method', nsid);
  const upstream = await fetch(mcpRouterUrl(envOf(event)), {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method: 'tools/call', params: { name: nsid, arguments: input } })
  });
  const upstreamText = await upstream.text();
  let payload: unknown = upstreamText;
  try { payload = upstreamText ? JSON.parse(upstreamText) : null; } catch { /* Preserve text payload. */ }
  if (!upstream.ok) return noStore({ error: 'MCP router request failed', upstream: payload }, { status: upstream.status });
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error?: { message?: string } }).error;
    return noStore({ error: error?.message ?? 'MCP router returned an error', upstream: payload }, { status: 502 });
  }
  const result = payload && typeof payload === 'object' && 'result' in payload ? (payload as { result?: unknown }).result : payload;
  const structured = result && typeof result === 'object' && 'structuredContent' in result ? (result as { structuredContent?: unknown }).structuredContent : result;
  return noStore(structured ?? {});
};

export const OPTIONS: RequestHandler = async () => new Response(null, {
  status: 204,
  headers: {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-max-age': '86400'
  }
});
