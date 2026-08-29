import '../apps/backend/src/config/env';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function verify() {
  const allEmails = await prisma.email.findMany({
    where: {
      subject: { startsWith: 'Module 6 Rate Limit Test' }
    },
    orderBy: { scheduledAt: 'asc' }
  });
  
  if (allEmails.length === 0) {
    console.log("No test emails found.");
    return;
  }
  
  // Group by senderId to find the latest test run
  const senders = new Set(allEmails.map(e => e.senderId));
  const latestSender = Array.from(senders).sort().pop();
  
  console.log(`Analyzing emails for sender: ${latestSender}`);
  
  const emails = allEmails.filter(e => e.senderId === latestSender);
  
  let sent = 0;
  let rescheduled = 0;
  
  for (const e of emails) {
    if (e.status === 'SENT') {
      sent++;
    } else if (e.status === 'SCHEDULED' || e.status === 'SENDING') {
      rescheduled++;
    }
    console.log(`- ${e.recipientEmail} | Status: ${e.status.padEnd(9)} | Scheduled At: ${e.scheduledAt.toISOString()}`);
  }
  
  console.log(`\nResults: ${sent} SENT, ${rescheduled} RESCHEDULED/PENDING`);
  await prisma.$disconnect();
}

verify().catch(console.error);
