import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting database seeding...');

  // 1. Upsert default test user
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@reachinbox.ai' },
    update: {},
    create: {
      id: 'usr_demo_reachinbox_001',
      email: 'demo@reachinbox.ai',
      name: 'Pravin Kumar (ReachInbox Demo)',
      googleId: 'google_oauth_demo_123456789',
      avatarUrl: 'https://lh3.googleusercontent.com/a/default-user',
    },
  });

  console.log(`[Seed] Demo user created/verified: ${demoUser.email} (ID: ${demoUser.id})`);

  // 2. Seed 3 initial fake senders with Ethereal SMTP references
  const sendersData = [
    {
      id: 'snd_reachinbox_growth_001',
      userId: demoUser.id,
      email: 'growth@reachinbox-outbox.io',
      displayName: 'Growth Team (ReachInbox)',
      smtpHost: 'smtp.ethereal.email',
      smtpPort: 587,
      smtpUser: 'growth.ethereal@reachinbox.ai',
      smtpPass: 'ethereal_growth_pass_secure',
      smtpSecure: false,
      isDefault: true,
    },
    {
      id: 'snd_reachinbox_updates_002',
      userId: demoUser.id,
      email: 'alex.updates@reachinbox-outbox.io',
      displayName: 'Alex Rivers (Product Updates)',
      smtpHost: 'smtp.ethereal.email',
      smtpPort: 587,
      smtpUser: 'alex.ethereal@reachinbox.ai',
      smtpPass: 'ethereal_alex_pass_secure',
      smtpSecure: false,
      isDefault: false,
    },
    {
      id: 'snd_reachinbox_support_003',
      userId: demoUser.id,
      email: 'support@reachinbox-outbox.io',
      displayName: 'Outbox Customer Support',
      smtpHost: 'smtp.ethereal.email',
      smtpPort: 587,
      smtpUser: 'support.ethereal@reachinbox.ai',
      smtpPass: 'ethereal_support_pass_secure',
      smtpSecure: false,
      isDefault: false,
    },
  ];

  for (const sender of sendersData) {
    const upserted = await prisma.sender.upsert({
      where: { email: sender.email },
      update: sender,
      create: sender,
    });
    console.log(`[Seed] Seeded sender: ${upserted.displayName} <${upserted.email}> [ID: ${upserted.id}]`);
  }

  // 3. Query all senders and display
  const allSenders = await prisma.sender.findMany({
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log('\n--- SEEDED SENDERS IN DATABASE ---');
  console.table(
    allSenders.map((s) => ({
      ID: s.id,
      Email: s.email,
      DisplayName: s.displayName,
      SMTP_Host: s.smtpHost,
      SMTP_Port: s.smtpPort,
      IsDefault: s.isDefault,
      Owner: s.user?.email ?? 'None',
    }))
  );
  console.log('----------------------------------\n');
}

main()
  .catch((e) => {
    console.error('[Seed Error]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
