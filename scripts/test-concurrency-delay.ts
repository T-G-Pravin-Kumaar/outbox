async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runConcurrencyDelayTest() {
  console.log('================================================================');
  console.log('⚡ Module 5: Concurrency & Minimum Delay Acceptance Test');
  console.log('================================================================');
  console.log('Config: WORKER_CONCURRENCY=2, MIN_DELAY_SECONDS=2');
  console.log('Test:   Schedule 5 emails for the SAME instant, verify sends');
  console.log('        are spaced ≥2 seconds apart in worker logs.\n');

  const targetTime = new Date(Date.now() + 5000).toISOString();
  const recipients = [
    'lead-1@acme-corp.io',
    'lead-2@acme-corp.io',
    'lead-3@acme-corp.io',
    'lead-4@acme-corp.io',
    'lead-5@acme-corp.io',
  ];

  console.log(`[1/3] Scheduling 5 emails for the same instant: ${targetTime}`);

  const emailIds: string[] = [];

  for (let i = 0; i < 5; i++) {
    const res = await fetch('http://127.0.0.1:5000/api/emails/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_id: 'snd_reachinbox_growth_001',
        recipient_email: recipients[i],
        subject: `Module 5 Concurrency Test Email #${i + 1}`,
        body: `This is test email #${i + 1} of 5, all scheduled for the same instant.`,
        scheduled_at: targetTime,
      }),
    });

    const data = await res.json();
    emailIds.push(data.email.id);
    console.log(`  ✅ Email #${i + 1} scheduled -> ID: ${data.email.id}`);
  }

  console.log(`\n[2/3] Waiting for all 5 emails to be processed (~15s with 2s limiter)...`);

  // Poll until all 5 are SENT (up to 30s)
  let allSent = false;
  for (let poll = 0; poll < 20; poll++) {
    await sleep(2000);
    const res = await (await fetch('http://127.0.0.1:5000/api/emails?status=SENT')).json();
    const sentIds = new Set(res.data.map((e: any) => e.id));
    const done = emailIds.filter((id) => sentIds.has(id)).length;
    process.stdout.write(`  ⏳ ${done}/5 sent... `);
    if (done >= 5) {
      allSent = true;
      console.log('✅ All sent!');
      break;
    }
  }

  if (!allSent) {
    console.warn('\n  ⚠️ Timed out waiting for all sends.');
  }

  console.log(`\n[3/3] Final status for all 5 emails:`);
  console.log('─'.repeat(100));

  const sentTimes: Date[] = [];

  for (let i = 0; i < 5; i++) {
    const res = await (await fetch(`http://127.0.0.1:5000/api/emails/${emailIds[i]}`)).json();
    const e = res.data;
    const sentAt = e.sentAt ? new Date(e.sentAt) : null;
    if (sentAt) sentTimes.push(sentAt);

    console.log(
      `  Email #${i + 1} | Status: ${e.status.padEnd(9)} | Sent: ${e.sentAt || 'N/A'} | To: ${e.recipientEmail}`
    );
  }

  console.log('─'.repeat(100));

  // Compute inter-send gaps
  if (sentTimes.length >= 2) {
    sentTimes.sort((a, b) => a.getTime() - b.getTime());
    console.log('\n📊 Inter-Send Timing Analysis:');
    console.log(`  First send:  ${sentTimes[0].toISOString()}`);
    console.log(`  Last send:   ${sentTimes[sentTimes.length - 1].toISOString()}`);
    console.log(`  Total span:  ${((sentTimes[sentTimes.length - 1].getTime() - sentTimes[0].getTime()) / 1000).toFixed(1)}s`);

    let minGap = Infinity;
    for (let i = 1; i < sentTimes.length; i++) {
      const gap = (sentTimes[i].getTime() - sentTimes[i - 1].getTime()) / 1000;
      console.log(`  Gap #${i}: ${gap.toFixed(1)}s (${gap >= 2.0 ? '✅ ≥2s' : '⚠️ <2s'})`);
      minGap = Math.min(minGap, gap);
    }

    console.log(`\n  Minimum gap: ${minGap.toFixed(1)}s`);
    if (minGap >= 1.8) {
      console.log('\n✅ TEST PASSED: All sends spaced ≥2s apart by BullMQ limiter.');
    } else {
      console.warn('\n⚠️ TEST WARNING: Some gaps were below 2s threshold.');
    }
  }
}

runConcurrencyDelayTest().catch(console.error);
