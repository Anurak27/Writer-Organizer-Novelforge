import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function fixCodexAliases() {
  console.log('Fetching all codex entries...');
  const entries = await db.codexEntry.findMany({});
  console.log(`Found ${entries.length} total entries.`);

  const badEntries: { id: string; name: string; aliases: string }[] = [];

  for (const entry of entries) {
    const raw = entry.aliases;
    if (raw === '[]') continue;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) continue;
      badEntries.push({ id: entry.id, name: entry.name, aliases: raw });
    } catch {
      badEntries.push({ id: entry.id, name: entry.name, aliases: raw });
    }
  }

  console.log(`\nFound ${badEntries.length} entries with non-array aliases:`);
  for (const b of badEntries) {
    console.log(`  - ${b.name}: aliases="${b.aliases}"`);
  }

  if (badEntries.length === 0) {
    console.log('No fixes needed!');
    return;
  }

  for (const b of badEntries) {
    let fixedAliases: string[];
    try {
      const parsed = JSON.parse(b.aliases);
      fixedAliases = Array.isArray(parsed) ? parsed : [String(parsed)];
    } catch {
      fixedAliases = b.aliases
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);
    }
    if (fixedAliases.length === 0) fixedAliases = [];

    console.log(`\n  Fixing ${b.name}:`);
    console.log(`    Before: "${b.aliases}"`);
    console.log(`    After:  ${JSON.stringify(fixedAliases)}`);

    await db.codexEntry.update({
      where: { id: b.id },
      data: { aliases: JSON.stringify(fixedAliases) },
    });
  }

  // Also check tags
  console.log('\n--- Checking tags field too ---');
  const badTags = entries.filter((e) => {
    if (e.tags === '[]') return false;
    try {
      const p = JSON.parse(e.tags);
      return !Array.isArray(p);
    } catch {
      return true;
    }
  });
  if (badTags.length > 0) {
    console.log(`Found ${badTags.length} entries with non-array tags, fixing...`);
    for (const b of badTags) {
      let fixed: string[];
      try {
        const p = JSON.parse(b.tags);
        fixed = Array.isArray(p) ? p : [String(p)];
      } catch {
        fixed = b.tags.split(',').map((t) => t.trim()).filter(Boolean);
      }
      await db.codexEntry.update({
        where: { id: b.id },
        data: { tags: JSON.stringify(fixed) },
      });
      console.log(`  Fixed tags for ${b.name}: ${JSON.stringify(fixed)}`);
    }
  } else {
    console.log('All tags are valid arrays.');
  }

  console.log('\nAll fixes applied!');
}

fixCodexAliases()
  .catch((e) => { console.error('Error:', e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
