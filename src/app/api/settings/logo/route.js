// /src/app/api/settings/logo/route.js
import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { logError } from '@/lib/logError';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('logo');
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) return NextResponse.json({ error: 'Only PNG and JPG files are accepted' }, { status: 400 });

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const dest   = path.join(process.cwd(), 'public', 'logo.png');
    await writeFile(dest, buffer);
    return NextResponse.json({ success: true });
  } catch (err) {
    await logError({ source: 'api/settings/logo/POST', error: err });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
