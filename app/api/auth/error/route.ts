import { NextRequest, NextResponse } from 'next/server';

/** Redirect Auth.js errors to /login (avoids default "Server error" HTML). */
export async function GET(req: NextRequest) {
  const error = req.nextUrl.searchParams.get('error') ?? 'unknown';
  const login = new URL('/login', req.url);
  login.searchParams.set('error', error);
  return NextResponse.redirect(login);
}
