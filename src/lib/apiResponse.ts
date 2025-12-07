import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  const responseInit: ResponseInit = { status: init?.status ?? 200, ...init };
  return NextResponse.json(data, responseInit);
}

export function jsonError(message: string, status: number = 500): NextResponse {
  return NextResponse.json({ message }, { status });
}
