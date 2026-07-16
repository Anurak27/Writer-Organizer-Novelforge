import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  try {
    const book = await db.book.findUnique({
      where: { id },
      include: {
        chapters: {
          orderBy: { sortOrder: 'asc' },
          include: {
            scenes: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });

    if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    return NextResponse.json(book);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch book' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  try {
    const { title, description, genre, status, penName, language, wordCountGoal, pov, povTense, synopsis, customPrompt, seriesId, seriesOrder } = await request.json();
    const book = await db.book.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(genre !== undefined && { genre: genre?.trim() || null }),
        ...(status !== undefined && { status }),
        ...(penName !== undefined && { penName: penName?.trim() || null }),
        ...(language !== undefined && { language }),
        ...(wordCountGoal !== undefined && { wordCountGoal: wordCountGoal ? Number(wordCountGoal) : null }),
        ...(pov !== undefined && { pov }),
        ...(povTense !== undefined && { povTense }),
        ...(synopsis !== undefined && { synopsis: synopsis?.trim() || null }),
        ...(customPrompt !== undefined && { customPrompt: customPrompt?.trim() || null }),
        ...(seriesId !== undefined && { seriesId: seriesId || null }),
        ...(seriesOrder !== undefined && { seriesOrder: seriesOrder != null ? Number(seriesOrder) : null }),
      },
    });
    return NextResponse.json(book);
  } catch {
    return NextResponse.json({ error: 'Failed to update book' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  try {
    await db.book.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete book' }, { status: 500 });
  }
}