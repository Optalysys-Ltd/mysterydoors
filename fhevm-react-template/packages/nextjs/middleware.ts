import { NextRequest, NextResponse } from "next/server";
import path from "path";
// the list of all allowed origins
const allowedOrigins = [
  'http://localhost:3000',
  'https://rpc.gcp-testnet-eth.dev.optalysys.com',
  'https://relayer.gcp-testnet-eth.dev.optalysys.com',
  'https://rpc.gcp-testnet-eth.blue.optalysys.com',
  'https://relayer.gcp-testnet-eth.blue.optalysys.com'
];

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  if (pathname.startsWith('/rpc-blue')) {
    const path = pathname.replace('/rpc-blue', '');
    const rewriteUrl = new URL(path, 'https://rpc.gcp-testnet-eth.blue.optalysys.com');
    return NextResponse.rewrite(rewriteUrl)
  }
  else if (pathname.startsWith('/rpc')) {
    const path = pathname.replace('/rpc', '');
    const rewriteUrl = new URL(path, 'https://rpc.gcp-testnet-eth.dev.optalysys.com');
    return NextResponse.rewrite(rewriteUrl)
  }

  // retrieve the current response
  const res = NextResponse.next()

  // retrieve the HTTP "Origin" header 
  // from the incoming request
  const origin = req.headers.get("origin") || "";

  // if the origin is an allowed one,
  // add it to the 'Access-Control-Allow-Origin' header
  if (allowedOrigins.includes(origin)) {
    res.headers.append('Access-Control-Allow-Origin', origin);
  }
  // add the remaining CORS headers to the response
  res.headers.append('Access-Control-Allow-Credentials', "true")
  res.headers.append('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT,OPTIONS')
  res.headers.append(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  return res
}

// specify the path regex to apply the middleware to
export const config = {
  matcher: ['/rpc/:path*', '/rpc-blue/:path*'],
}