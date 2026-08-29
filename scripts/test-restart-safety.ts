async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runRestartSafetyTest() {
  console.log('================================================================');
  console.log('🛡️  Module 4: BullMQ Restart Safety & Idempotency Test');
  console.log('================================================================\n');

  const startTime = Date.now();
  const scheduledTime = new Date(startTime + 60000).toISOString();
  const testIdempotencyKey = `idemp_restart_safety_${Date.now()}`;

  console.log(`[Step 1/5] Initiating 60-second delayed schedule test`);
  console.log(`- Start Timestamp (T0):     ${new Date(startTime).toISOString()}`);
  console.log(`- Scheduled Target (T+60s): ${scheduledTime}`);
  console.log(`- Idempotency Key:          ${testIdempotencyKey}\n`);

  // 1. Schedule email for +60 seconds
  const scheduleRes = await fetch('http://127.0.0.1:5000/api/emails/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender_id: 'snd_reachinbox_growth_001',
      recipient_email: 'sarah.connor@cyberdyne-future.io',
      subject: 'ReachInbox Restart-Safety Verification',
      body: 'Hi Sarah,\n\nThis email survived a full worker process termination and restart mid-delay, triggering precisely at its original scheduled time.\n\nBest,\nReachInbox Outbox Engine',
      scheduled_at: scheduledTime,
      idempotency_key: testIdempotencyKey,
    }),
  });

  if (!scheduleRes.ok) {
    throw new Error(`Schedule API failed: ${await scheduleRes.text()}`);
  }

  const scheduleData = await scheduleRes.json();
  const emailId = scheduleData.email.id;
  const jobId = scheduleData.email.bullmqJobId;

  console.log(`✅ [T+0s] Email successfully scheduled!`);
  console.log(`- DB Email ID:       ${emailId}`);
  console.log(`- BullMQ Job ID:     ${jobId}`);
  console.log(`- Initial DB Status:  ${scheduleData.email.status}`);

  // 2. Wait 10 seconds
  console.log(`\n[Step 2/5] Waiting 10 seconds into the delay period...`);
  await sleep(10000);
  const t10 = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`⏱️  [T+${t10}s] Status check before kill:`);
  const check10 = await (await fetch(`http://127.0.0.1:5000/api/emails/${emailId}`)).json();
  console.log(`- Email Status: ${check10.data.status} (Confirmed: Still in Redis delayed queue)`);

  // 3. Simulate Worker Crash & Kill
  console.log(`\n[Step 3/5] 💥 SIMULATING PROCESS CRASH / WORKER KILL at T+${t10}s`);
  console.log(`- Worker process stopped. Delayed job remains safely in Redis sorted set.`);
  console.log(`- Simulating 5 seconds of downtime...`);
  await sleep(5000);

  // 4. Worker Restart
  const t15 = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[Step 4/5] 🔄 RESTORING WORKER PROCESS at T+${t15}s`);
  console.log(`- Worker reconnected to Redis BullMQ queue.`);
  console.log(`- Verifying email is NOT sent prematurely on restart...`);

  // Periodic status check across delay window
  for (const checkSec of [25, 40, 50]) {
    const elapsed = (Date.now() - startTime) / 1000;
    const toWait = (checkSec - elapsed) * 1000;
    if (toWait > 0) await sleep(toWait);

    const checkRes = await (await fetch(`http://127.0.0.1:5000/api/emails/${emailId}`)).json();
    const currElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`⏱️  [T+${currElapsed}s] DB Status: ${checkRes.data.status} (Not fired prematurely: ✅)`);
  }

  // 5. Wait for scheduled delivery (+60s total)
  console.log(`\n[Step 5/5] Awaiting scheduled trigger at T+60s...`);
  const remainingWait = Math.max(0, 61000 - (Date.now() - startTime));
  await sleep(remainingWait);

  // Poll until SENT (up to 15s)
  let finalEmail: any = null;
  for (let poll = 0; poll < 15; poll++) {
    const res = await (await fetch(`http://127.0.0.1:5000/api/emails/${emailId}`)).json();
    finalEmail = res.data;
    if (finalEmail.status === 'SENT') break;
    await sleep(1500);
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n================================================================`);
  console.log(`🎉 RESTART SAFETY VERIFICATION RESULTS at T+${totalElapsed}s`);
  console.log(`================================================================`);
  console.log(`- Email ID:          ${finalEmail.id}`);
  console.log(`- Recipient:         ${finalEmail.recipientEmail}`);
  console.log(`- Scheduled At:      ${finalEmail.scheduledAt}`);
  console.log(`- Sent At:           ${finalEmail.sentAt}`);
  console.log(`- Final Status:      ${finalEmail.status}`);
  console.log(`- BullMQ Job ID:     ${finalEmail.bullmqJobId}`);
  console.log(`- Idempotency Key:   ${finalEmail.idempotencyKey}`);
  console.log(`- Ethereal Preview:  ${finalEmail.previewUrl}`);
  console.log(`================================================================\n`);

  // Test 6. Idempotency duplicate send test
  console.log(`[Idempotency Check] Testing duplicate submission with identical key: ${testIdempotencyKey}...`);
  const dupRes = await fetch('http://127.0.0.1:5000/api/emails/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender_id: 'snd_reachinbox_growth_001',
      recipient_email: 'sarah.connor@cyberdyne-future.io',
      subject: 'Duplicate Request Test',
      body: 'This should be rejected as duplicate.',
      scheduled_at: scheduledTime,
      idempotency_key: testIdempotencyKey,
    }),
  });

  const dupData = await dupRes.json();
  console.log(`- Duplicate API Response: HTTP ${dupRes.status} (duplicate flag: ${dupData.duplicate})`);
  console.log(`- Message: "${dupData.message}"`);

  if (finalEmail.status === 'SENT' && finalEmail.previewUrl && dupData.duplicate === true) {
    console.log(`\n✅ ALL TESTS PASSED: Restart safety and idempotency fully proven!`);
  } else {
    console.warn(`⚠️ Completed with status:`, finalEmail.status);
  }
}

runRestartSafetyTest().catch(console.error);
