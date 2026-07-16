import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const books = await db.book.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { chapters: true } },
        chapters: {
          include: {
            scenes: { select: { wordCount: true } },
          },
        },
      },
    });

    const bookData = books.map((book) => {
      const totalWords = book.chapters.reduce(
        (sum, ch) => sum + ch.scenes.reduce((s, sc) => s + sc.wordCount, 0),
        0
      );
      const sceneCount = book.chapters.reduce((sum, ch) => sum + ch.scenes.length, 0);
      return {
        id: book.id,
        title: book.title,
        description: book.description,
        genre: book.genre,
        status: book.status,
        sortOrder: book.sortOrder,
        createdAt: book.createdAt,
        updatedAt: book.updatedAt,
        totalWords,
        chapterCount: book.chapters.length,
        sceneCount,
      };
    });

    return NextResponse.json(bookData);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch books' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, description, genre, penName, language, wordCountGoal, pov, povTense, synopsis, customPrompt, seriesId, seriesOrder } = await request.json();
    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Get next sort order
    const maxOrder = await db.book.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
    const nextOrder = (maxOrder?.sortOrder ?? -1) + 1;

    const book = await db.book.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        genre: genre?.trim() || null,
        penName: penName?.trim() || null,
        language: language || 'en',
        wordCountGoal: wordCountGoal ? Number(wordCountGoal) : null,
        pov: pov || 'third_past',
        povTense: povTense || 'past',
        synopsis: synopsis?.trim() || null,
        customPrompt: customPrompt?.trim() || null,
        seriesId: seriesId || null,
        seriesOrder: seriesOrder != null ? Number(seriesOrder) : null,
        sortOrder: nextOrder,
      },
    });

    return NextResponse.json(book, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create book' }, { status: 500 });
  }
}