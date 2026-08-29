async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runRateLimitTest() {
  console.log('================================================================');
  console.log('⚡ Module 6: Per-Sender Rate Limit Acceptance Test');
  console.log('================================================================');
  console.log('Config: MAX_EMAILS_PER_HOUR_PER_SENDER=5');
  console.log('Test:   Schedule 20 emails for one sender instantly.');
  console.log('        Verify 5 are SENT, 15 are rescheduled to future windows.\n');

  const senderId = 'snd_ratelimit_test_' + Date.now();
  const targetTime = new Date().toISOString();
  
  console.log(`[1/3] Scheduling 20 emails for sender ${senderId} at ${targetTime}`);

  const emailIds: string[] = [];

  for (let i = 0; i < 20; i++) {
    const res = await fetch('http://127.0.0.1:5000/api/emails/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_id: senderId,
        recipient_email: `lead-${i+1}@acme-corp.io`,
        subject: `Module 6 Rate Limit Test Email #${i + 1}`,
        body: `This is test email #${i + 1} of 20, all scheduled for the same instant.`,
        scheduled_at: targetTime,
      }),
    });

    const data = await res.json();
    emailIds.push(data.email.id);
  }
  
  console.log(`  ✅ Scheduled 20 emails.`);

  console.log(`\n[2/3] Waiting for worker to process (~15-20s)...`);

  // Wait enough time for 20 jobs to be processed by BullMQ.
  // We have a 2s delay between jobs, but rate limited jobs skip the Ethereal send and just requeue.
  // Wait about 15 seconds to ensure all 20 are touched.
  await sleep(15000);

  console.log(`\n[3/3] Final status for all 20 emails:`);
  console.log('─'.repeat(120));

  let sentCount = 0;
  let rescheduledCount = 0;

  for (let i = 0; i < 20; i++) {
    const res = await (await fetch(`http://127.0.0.1:5000/api/emails/${emailIds[i]}`)).json();
    const e = res.data;
    
    if (e.status === 'SENT') {
      sentCount++;
    } else if (e.status === 'SCHEDULED' && new Date(e.scheduledAt).getTime() > new Date(targetTime).getTime()) {
      rescheduledCount++;
    }

    console.log(
      `  Email #${(i + 1).toString().padStart(2, '0')} | Status: ${e.status.padEnd(9)} | Scheduled For: ${e.scheduledAt} | To: ${e.recipientEmail}`
    );
  }

  console.log('─'.repeat(120));

  console.log(`\n📊 Rate Limit Analysis:`);
  console.log(`  Sent:        ${sentCount} (Expected: 5)`);
  console.log(`  Rescheduled: ${rescheduledCount} (Expected: 15)`);

  if (sentCount === 5 && rescheduledCount === 15) {
    console.log('\n✅ TEST PASSED: 5 sent, 15 pushed to next window(s) successfully.');
  } else {
    console.warn('\n⚠️ TEST WARNING: Did not match expected 5/15 split.');
  }
}

runRateLimitTest().catch(console.error);
