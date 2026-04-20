import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = "http://127.0.0.1:8000";

async function proxyRequest(request: NextRequest, path: string[]): Promise<NextResponse> {
  const joined = path.join("/");
  const targetUrl = `${BACKEND_BASE}/api/${joined}${request.nextUrl.search}`;

  const bodyBuffer = !["GET", "HEAD"].includes(request.method)
    ? Buffer.from(await request.arrayBuffer())
    : undefined;

  try {
    const res = await fetch(targetUrl, {
      method: request.method,
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
      },
      body: bodyBuffer,
      redirect: "follow",
    });

    const body = await res.arrayBuffer();
    const headers = new Headers();
    res.headers.forEach((v, k) => {
      if (!["content-encoding", "transfer-encoding"].includes(k)) headers.set(k, v);
    });

    return new NextResponse(body, { status: res.status, headers });
  } catch (e: any) {
    console.error("Proxy error:", e.message);
    return NextResponse.json({ error: "Backend unreachable", detail: e.message }, { status: 502 });
  }
}

async function handler(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
