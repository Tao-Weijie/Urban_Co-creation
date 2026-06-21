import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get('file');
    if (file !== 'game' && file !== 'graph') {
      return NextResponse.json({ error: 'Invalid file parameter' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'app', 'api', 'py-source', `${file}.py`);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: `File not found: ${file}.py` }, { status: 404 });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('Failed to read python source file:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
