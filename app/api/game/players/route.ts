import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Forward request to FastAPI backend running on port 8000
    const response = await fetch('http://127.0.0.1:8000/api/py/game/players', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 0 } // disable cache to fetch fresh config
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Python service failed: ${errorText}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('API Error in game players route:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
