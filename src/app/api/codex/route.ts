import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { safeJsonParse } from '@/lib/utils';

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
      where.name = { contains: search, mode: 'insensitive' };
    }

    const entries = await db.codexEntry.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { name: 'asc' }],
    });

    // Parse JSON strings back to arrays — use safeJsonParse to handle corrupted data
    const parsed = entries.map((e) => ({
      ...e,
      aliases: safeJsonParse<string[]>(e.aliases, [], true),
      tags: safeJsonParse<string[]>(e.tags, [], true),
      metadata: safeJsonParse<Record<string, string>>(e.metadata, {}),
    }));

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('[GET /api/codex] Error:', error);
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

    // Validate and normalize aliases/tags/metadata to ensure correct types
    const normalizedAliases = Array.isArray(aliases)
      ? aliases.filter((a): a is string => typeof a === 'string').map(a => a.trim()).filter(Boolean)
      : [];
    const normalizedTags = Array.isArray(tags)
      ? tags.filter((t): t is string => typeof t === 'string').map(t => t.trim()).filter(Boolean)
      : [];
    const normalizedMetadata = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? metadata
      : {};

    const entry = await db.codexEntry.create({
      data: {
        bookId: bookId || null,
        type,
        name: name.trim(),
        description: description?.trim() || '',
        aliases: JSON.stringify(normalizedAliases),
        tags: JSON.stringify(normalizedTags),
        metadata: JSON.stringify(normalizedMetadata),
        isPinned: isPinned ?? false,
        imagePath: imagePath || null,
      },
    });

    return NextResponse.json({
      ...entry,
      aliases: normalizedAliases,
      tags: normalizedTags,
      metadata: normalizedMetadata,
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/codex] Error:', error);
    return NextResponse.json({ error: 'Failed to create codex entry' }, { status: 500 });
  }
}