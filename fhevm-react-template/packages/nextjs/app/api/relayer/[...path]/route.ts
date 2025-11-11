// app/api/relayer/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs"; // ensure full body access (not Edge)

const RELAYER_ORIGIN = "https://relayer.gcp-testnet-eth.dev.optalysys.com";
const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "https://rpc.gcp-testnet-eth.dev.optalysys.com",
  "https://relayer.gcp-testnet-eth.dev.optalysys.com",
]);

function corsOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  return origin && ALLOWED_ORIGINS.has(origin) ? origin : null;
}
function applyCorsHeaders(h: Headers, origin: string | null) {
  if (origin) h.set("Access-Control-Allow-Origin", origin);
  h.set("Vary", "Origin");
  h.set("Access-Control-Allow-Credentials", "true");
  h.set("Access-Control-Allow-Methods", "GET,DELETE,PATCH,POST,PUT,OPTIONS");
  h.set(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );
}
function stripHopByHopHeaders(h: Headers) {
  for (const k of [
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
  ]) h.delete(k);
}

function buildTargetUrl(req: NextRequest, pathParts: string[]) {
  const relPath = pathParts.join("/");
  const qs = req.nextUrl.search;
  return `${RELAYER_ORIGIN}/${relPath}${qs}`;
}

async function proxy(req: NextRequest, method: string, pathParts: string[]) {
  const targetUrl = buildTargetUrl(req, pathParts);

  const outHeaders = new Headers(req.headers);
  stripHopByHopHeaders(outHeaders);
  outHeaders.delete("host");
  outHeaders.delete("accept-encoding");

  const hasBody = method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";

  // STREAMING body (keep large payloads efficient)
  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers: outHeaders,
    body: hasBody ? (req.body as any) : undefined,
    redirect: "manual",
    duplex: hasBody ? "half" : undefined, // required for Node fetch streams
  };

  const upstreamRes = await fetch(targetUrl, init);

  const resHeaders = new Headers(upstreamRes.headers);
  stripHopByHopHeaders(resHeaders);
  applyCorsHeaders(resHeaders, corsOrigin(req));

  return new NextResponse(upstreamRes.body, {
    status: upstreamRes.status,
    headers: resHeaders,
  });
}

/* ========= CORS preflight ========= */
export async function OPTIONS(req: NextRequest) {
  const headers = new Headers();
  applyCorsHeaders(headers, corsOrigin(req));
  return new NextResponse(null, { status: 204, headers });
}

/* ========= Handlers (await params) ========= */

type PathParam = { path: string[] };

export async function GET(req: NextRequest, ctx: { params: Promise<PathParam> }) {
  const { path } = await ctx.params;            // ⟵ await here
  return proxy(req, "GET", path ?? []);
}

export async function POST(req: NextRequest, ctx: { params: Promise<PathParam> }) {
  const { path } = await ctx.params;            // ⟵ await here
  return proxy(req, "POST", path ?? []);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<PathParam> }) {
  const { path } = await ctx.params;            // ⟵ await here
  return proxy(req, "PUT", path ?? []);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<PathParam> }) {
  const { path } = await ctx.params;            // ⟵ await here
  return proxy(req, "PATCH", path ?? []);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<PathParam> }) {
  const { path } = await ctx.params;            // ⟵ await here
  return proxy(req, "DELETE", path ?? []);
}
