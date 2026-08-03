import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { existsSync } from 'fs';

// On Vercel, /tmp is the only writable directory
function getUploadDir(purpose: string): string {
  const base = process.env.VERCEL ? '/tmp' : join(process.cwd(), 'public');
  const subDir = purpose === 'cover' ? 'covers' : purpose === 'codex' ? 'codex' : 'inline';
  return join(base, 'uploads', subDir);
}

function getPublicPath(purpose: string, uniqueName: string): string {
  // In production, images are served via /api/upload/[id] or stored externally
  // For now, use a path that the client can reference
  return `/api/upload/file?path=uploads/${purpose === 'cover' ? 'covers' : purpose === 'codex' ? 'codex' : 'inline'}/${uniqueName}`;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const purpose = (formData.get('purpose') as string) || 'inline';
    const bookId = formData.get('bookId') as string | null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only images allowed.' }, { status: 400 });
    }

    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'png';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const dir = getUploadDir(purpose);
    const filePath = join(dir, uniqueName);

    await mkdir(dir, { recursive: true });
    await writeFile(filePath, buffer);

    const publicPath = getPublicPath(purpose, uniqueName);

    const imageRecord = await db.uploadedImage.create({
      data: {
        bookId: bookId || null,
        fileName: file.name,
        filePath: publicPath,
        mimeType: file.type,
        size: buffer.length,
        purpose,
      },
    });

    return NextResponse.json({
      id: imageRecord.id,
      url: publicPath,
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

// Serve uploaded files (needed for Vercel where /tmp is not publicly accessible)
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path');
    if (!filePath) return NextResponse.json({ error: 'No path provided' }, { status: 400 });

    // Prevent directory traversal
    const safePath = filePath.replace(/\.\./g, '');
    const fullPath = process.env.VERCEL
      ? join('/tmp', safePath)
      : join(process.cwd(), 'public', safePath);

    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const { readFile } = await import('fs/promises');
    const buffer = await readFile(fullPath);

    const ext = safePath.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
    };
    const contentType = mimeMap[ext || ''] || 'application/octet-stream';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('Serve file error:', err);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
