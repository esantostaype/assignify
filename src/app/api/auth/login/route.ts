/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-key-change-in-production'
);

// Maneja login/logout (cookies de sesión): nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic';

// Credenciales hardcodeadas
const VALID_CREDENTIALS = {
  email: 'esantos@inszoneins.com',
  password: 'Ersa#123!'
};

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Validación de entrada
    if (!email || !password) {
      return NextResponse.json({
        success: false,
        message: 'Email and password are required'
      }, { status: 400 });
    }

    // Validar credenciales
    if (email === VALID_CREDENTIALS.email && password === VALID_CREDENTIALS.password) {
      // Crear JWT token usando jose
      const token = await new SignJWT({
        email: email, 
        authenticated: true,
        loginTime: new Date().toISOString()
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('7d')
        .setIssuedAt()
        .sign(JWT_SECRET);

      // Crear respuesta
      const response = NextResponse.json({
        success: true,
        message: 'Login successful',
        user: { email }
      });

      // Establecer cookie httpOnly
      response.cookies.set({
        name: 'auth-token',
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 días en segundos
        path: '/',
      });

      return response;
    } else {
      // Pequeño delay para prevenir ataques de fuerza bruta
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return NextResponse.json({
        success: false,
        message: 'Invalid email or password'
      }, { status: 401 });
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}

// Logout endpoint
export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    message: 'Logout successful',
    loggedOut: true
  });

  // Limpiar cookie
  response.cookies.delete('auth-token');

  return response;
}