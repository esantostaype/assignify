// src/app/api/webhook-debug/route.ts
import { NextResponse } from 'next/server'

// Usa request.url (challenge/debug): nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const timestamp = new Date().toISOString();
  
  try {
    const rawBody = await req.text();

    // Intentar parsear JSON
    let jsonBody = null;
    try {
      jsonBody = JSON.parse(rawBody);
    } catch (e) {
      // Cuerpo no es JSON válido: se reporta en la respuesta.
    }

    // Respuesta exitosa para ClickUp
    return NextResponse.json({
      success: true,
      message: 'Webhook debug received successfully',
      timestamp,
      receivedData: {
        bodyLength: rawBody.length,
        eventType: jsonBody?.event || 'unknown',
        taskId: jsonBody?.task_id || 'unknown'
      }
    }, { status: 200 });
    
  } catch (error) {
    console.error('Debug webhook error:', error);

    return NextResponse.json({
      error: 'Debug webhook error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp
    }, { status: 200 }); // Siempre 200 para ClickUp
  }
}

export async function GET(req: Request) {
  // Para verificación de ClickUp
  const { searchParams } = new URL(req.url);
  const challenge = searchParams.get('challenge');
  
  if (challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  return NextResponse.json({
    status: 'Debug endpoint active',
    timestamp: new Date().toISOString(),
    message: 'Use POST to receive webhook data'
  });
}