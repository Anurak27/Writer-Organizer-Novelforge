import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const bookId = searchParams.get('bookId');
    const type = searchParams.get('type');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};

    // If no bookId, show global entries. If bookId provided, show that book's entries + global
    if (bookId) {
      where.OR = [{ bookId }, { bookId: null }];
    }

    if (type) {
      where.type = type;
    }

    if (search) {
      where.OR = [
        ...((where.OR as unknown[]) || []),
        { name: { contains: search } },
      ];
    }

    const entries = await db.codexEntry.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { name: 'asc' }],
    });

    // Parse JSON strings back to arrays
    const parsed = entries.map((e) => ({
      ...e,
      aliases: JSON.parse(e.aliases || '[]'),
      tags: JSON.parse(e.tags || '[]'),
      metadata: JSON.parse(e.metadata || '{}'),
    }));

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch codex entries' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { bookId, type, name, description, aliases, tags, metadata, isPinned, imagePath } = await request.json();

    if (!type || !name?.trim()) {
      return NextResponse.json({ error: 'Type and name are required' }, { status: 400 });
    }

    const entry = await db.codexEntry.create({
      data: {
        bookId: bookId || null,
        type,
        name: name.trim(),
        description: description?.trim() || '',
        aliases: JSON.stringify(aliases || []),
        tags: JSON.stringify(tags || []),
        metadata: JSON.stringify(metadata || {}),
        isPinned: isPinned ?? false,
        imagePath: imagePath || null,
      },
    });

    return NextResponse.json({
      ...entry,
      aliases: JSON.parse(entry.aliases),
      tags: JSON.parse(entry.tags),
      metadata: JSON.parse(entry.metadata),
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create codex entry' }, { status: 500 });
  }
}