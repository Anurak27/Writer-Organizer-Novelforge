import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { verifyAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const purpose = (formData.get('purpose') as string) || 'general';
    const bookId = (formData.get('bookId') as string) || null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type) && purpose !== 'codex') {
      return NextResponse.json({ error: 'Invalid file type. Use JPEG, PNG, GIF, or WebP.' }, { status: 400 });
    }

    // Limit file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum 5MB.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'bin';
    const uniqueName = `${purpose}_${randomUUID().slice(0, 8)}.${ext}`;

    // Determine save path
    const isVercel = !!process.env.VERCEL;
    const baseDir = isVercel ? '/tmp' : join(process.cwd(), 'public', 'uploads');
    const subDir = purpose === 'cover' ? 'covers' : purpose === 'codex' ? 'codex' : 'general';
    const fullDir = join(baseDir, subDir);

    // Ensure directory exists
    if (!existsSync(fullDir)) {
      await mkdir(fullDir, { recursive: true });
    }

    const filePath = join(fullDir, uniqueName);
    await writeFile(filePath, buffer);

    // Generate URL path for serving
    const urlPath = isVercel
      ? `/api/upload?file=${encodeURIComponent(join(subDir, uniqueName))}`
      : `/uploads/${subDir}/${uniqueName}`;

    // Save record in database
    await db.uploadedImage.create({
      data: {
        bookId,
        fileName: file.name,
        filePath: join(subDir, uniqueName),
        mimeType: file.type,
        size: file.size,
        purpose,
      },
    });

    return NextResponse.json({ url: urlPath, fileName: uniqueName });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'Upload failed: ' + (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}

// GET handler to serve files from /tmp on Vercel
export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const fileParam = req.nextUrl.searchParams.get('file');
  if (!fileParam) {
    return NextResponse.json({ error: 'Missing file parameter' }, { status: 400 });
  }

  // Security: prevent path traversal
  const cleanPath = fileParam.replace(/\.\./g, '').replace(/^\//, '');

  const isVercel = !!process.env.VERCEL;
  const basePath = isVercel ? '/tmp' : join(process.cwd(), 'public');
  const fullPath = join(basePath, cleanPath);

  if (!existsSync(fullPath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const { readFile } = await import('fs/promises');
  const buffer = await readFile(fullPath);

  // Determine content type
  const ext = cleanPath.split('.').pop()?.toLowerCase();
  const contentTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  };
  const contentType = contentTypes[ext || ''] || 'application/octet-stream';

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}