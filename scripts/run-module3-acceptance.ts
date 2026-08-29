async function runAcceptanceTest() {
  console.log('================================================================');
  console.log('🚀 Module 3 Acceptance Test: End-to-End Core Email Scheduling');
  console.log('================================================================');

  const now = Date.now();
  const scheduledTime = new Date(now + 10000).toISOString();
  console.log(`[1/4] Current time: ${new Date(now).toISOString()}`);
  console.log(`[1/4] Target scheduled time (+10s): ${scheduledTime}`);

  const payload = {
    sender_id: 'snd_reachinbox_growth_001',
    recipient_email: 'sarah.founder@acme-ventures.com',
    subject: 'Outbox Scheduler Live Verification Demo',
    body: 'Hi Sarah,\n\nThis email was scheduled exactly 10 seconds ago using BullMQ delayed jobs (no cron) and delivered via fake SMTP (Ethereal Email).\n\nBest,\nReachInbox Outbox Team',
    scheduled_at: scheduledTime,
  };

  console.log('\n[2/4] Calling POST http://127.0.0.1:5000/api/emails/schedule...');
  const scheduleRes = await fetch('http://127.0.0.1:5000/api/emails/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!scheduleRes.ok) {
    throw new Error(`Schedule API failed with HTTP ${scheduleRes.status}: ${await scheduleRes.text()}`);
  }

  const scheduleData = await scheduleRes.json();
  const emailId = scheduleData.email.id;
  const jobId = scheduleData.email.bullmqJobId;

  console.log(`✅ Email scheduled successfully!`);
  console.log(`- Email ID: ${emailId}`);
  console.log(`- BullMQ Delayed Job ID: ${jobId}`);
  console.log(`- Initial DB Status: ${scheduleData.email.status}`);
  console.log(`- Computed Delay: ${scheduleData.scheduling.delaySeconds} seconds`);

  // Verify immediate DB status
  const immediateRes = await fetch(`http://127.0.0.1:5000/api/emails/${emailId}`);
  const immediateData = await immediateRes.json();
  console.log(`- Verified Immediate DB Status: ${immediateData.data.status}`);

  console.log(`\n[3/4] Waiting 12 seconds for BullMQ delayed job timer to trigger and Worker to send...`);
  for (let i = 10; i >= 0; i -= 2) {
    process.stdout.write(`⏳ Delivery in ~${i}s... `);
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log('\n');

  // Query updated DB status
  console.log('[4/4] Verifying final DB record transition from SCHEDULED -> SENT...');
  const finalRes = await fetch(`http://127.0.0.1:5000/api/emails/${emailId}`);
  const finalData = await finalRes.json();
  const email = finalData.data;

  console.log('\n================================================================');
  console.log('🎉 ACCEPTANCE CHECK RESULTS');
  console.log('================================================================');
  console.log(`- Email ID:         ${email.id}`);
  console.log(`- Recipient:        ${email.recipientEmail}`);
  console.log(`- Subject:          "${email.subject}"`);
  console.log(`- Scheduled At:     ${email.scheduledAt}`);
  console.log(`- Sent At:          ${email.sentAt}`);
  console.log(`- Final Status:     ${email.status}`);
  console.log(`- BullMQ Job ID:    ${email.bullmqJobId}`);
  console.log(`- Ethereal Preview:  ${email.previewUrl}`);
  console.log('================================================================\n');

  if (email.status === 'SENT' && email.previewUrl) {
    console.log('✅ TEST PASSED: Full lifecycle from SCHEDULED -> SENT confirmed with live Ethereal link!');
  } else {
    console.warn('⚠️ Test status:', email.status);
  }
}

runAcceptanceTest().catch(console.error);
