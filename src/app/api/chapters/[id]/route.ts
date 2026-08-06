import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  try {
    const { title, synopsis, sortOrder, date } = await request.json();
    const chapter = await db.chapter.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(synopsis !== undefined && { synopsis: synopsis?.trim() || null }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(date !== undefined && { date: date?.trim() || null }),
      },
    });
    return NextResponse.json(chapter);
  } catch {
    return NextResponse.json({ error: 'Failed to update chapter' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  try {
    await db.chapter.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete chapter' }, { status: 500 });
  }
}