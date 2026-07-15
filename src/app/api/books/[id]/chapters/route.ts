import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id: bookId } = await params;

  try {
    const chapters = await db.chapter.findMany({
      where: { bookId },
      orderBy: { sortOrder: 'asc' },
      include: {
        scenes: {
          orderBy: { sortOrder: 'asc' },
          select: { id: true, title: true, status: true, wordCount: true, sortOrder: true },
        },
      },
    });
    return NextResponse.json(chapters);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch chapters' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id: bookId } = await params;

  try {
    const { title, synopsis } = await request.json();
    const maxOrder = await db.chapter.findFirst({
      where: { bookId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const nextOrder = (maxOrder?.sortOrder ?? -1) + 1;

    const chapter = await db.chapter.create({
      data: {
        bookId,
        title: title?.trim() || 'Untitled Chapter',
        synopsis: synopsis?.trim() || null,
        sortOrder: nextOrder,
      },
      include: { scenes: { orderBy: { sortOrder: 'asc' } } },
    });

    return NextResponse.json(chapter, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create chapter' }, { status: 500 });
  }
}