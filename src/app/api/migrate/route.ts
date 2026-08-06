import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// TEMPORARY migration endpoint — REMOVE AFTER USE
export async function POST() {
  try {
    // Add date column to Chapter table if it doesn't exist
    await db.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Chapter' AND column_name = 'date') THEN
          ALTER TABLE \"Chapter\" ADD COLUMN \"date\" TEXT;
        END IF;
      END $$;
    `);
    return NextResponse.json({ success: true, message: 'Migration applied: added date column to Chapter' });
  } catch (err) {
    return NextResponse.json({ error: 'Migration failed', details: String(err) }, { status: 500 });
  }
}
