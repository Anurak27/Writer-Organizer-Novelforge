const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const hash = await prisma.appSetting.findUnique({ where: { key: 'master_password_hash' } });
    console.log('Password hash exists:', !!hash);
    if (hash) console.log('Hash value (first 30 chars):', hash.value.substring(0, 30) + '...');
    const token = await prisma.appSetting.findUnique({ where: { key: 'session_token' } });
    console.log('Session token exists:', !!token);
    const all = await prisma.appSetting.findMany();
    console.log('All settings keys:', all.map(s => s.key));
  } catch(e) { console.error('DB Error:', e.message); }
  await prisma.$disconnect();
});
