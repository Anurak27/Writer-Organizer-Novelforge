import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const auth = verifyAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const purpose = (formData.get('purpose') as string) || 'inline'; // cover, codex, inline
    const bookId = formData.get('bookId') as string | null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only images allowed.' }, { status: 400 });
    }

    // Max 10MB
    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'png';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const dirMap: Record<string, string> = {
      cover: 'public/uploads/covers',
      codex: 'public/uploads/codex',
      inline: 'public/uploads/inline',
    };
    const dir = dirMap[purpose] || dirMap.inline;
    const filePath = join(process.cwd(), dir, uniqueName);

    await mkdir(dir, { recursive: true });
    await writeFile(filePath, buffer);

    // Save to DB
    const imageRecord = await db.uploadedImage.create({
      data: {
        bookId: bookId || null,
        fileName: file.name,
        filePath: `/${dir.split('/').slice(-2).join('/')}/${uniqueName}`,
        mimeType: file.type,
        size: buffer.length,
        purpose,
      },
    });

    return NextResponse.json({
      id: imageRecord.id,
      url: imageRecord.filePath,
      fileName: file.name,
      mimeType: file.type,
      size: buffer.length,
      purpose,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
