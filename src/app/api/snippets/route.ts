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
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};

    if (bookId) {
      where.OR = [{ bookId }, { bookId: null }];
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      const existingOr = (where.OR as unknown[]) || [];
      where.OR = [
        ...existingOr,
        { title: { contains: search } },
        { content: { contains: search } },
      ];
    }

    const snippets = await db.snippet.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    const parsed = snippets.map((s) => ({
      ...s,
      tags: JSON.parse(s.tags || '[]'),
    }));

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch snippets' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, content, category, tags, bookId } = await request.json();

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const maxSort = await db.snippet.aggregate({
      _max: { sortOrder: true },
    });
    const nextSort = (maxSort._max.sortOrder ?? -1) + 1;

    const snippet = await db.snippet.create({
      data: {
        title: title.trim(),
        content: content?.trim() || '',
        category: category || 'general',
        tags: JSON.stringify(tags || []),
        sortOrder: nextSort,
        bookId: bookId || null,
      },
    });

    return NextResponse.json(
      {
        ...snippet,
        tags: JSON.parse(snippet.tags || '[]'),
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: 'Failed to create snippet' }, { status: 500 });
  }
}