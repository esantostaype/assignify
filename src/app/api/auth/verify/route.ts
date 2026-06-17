/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/auth/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-key-change-in-production'
);

// Lee request.cookies: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({
        success: false,
        message: 'No authentication token provided',
        requiresLogin: true
      }, { status: 401 });
    }

    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);

      return NextResponse.json({
        success: true,
        user: {
          email: payload.email
        },
        authenticated: true
      });
    } catch {
      // Limpiar cookie inválida
      const response = NextResponse.json({
        success: false,
        message: 'Invalid or expired token',
        requiresLogin: true,
        tokenError: true
      }, { status: 401 });

      // Limpiar cookie
      response.cookies.delete('auth-token');

      return response;
    }
  } catch (error) {
    console.error('Verify endpoint error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      requiresLogin: true
    }, { status: 500 });
  }
}