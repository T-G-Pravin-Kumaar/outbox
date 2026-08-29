const BASE = 'http://localhost:5000';

const emails = [
  {
    recipient_email: 'alice.johnson@acme-ventures.com',
    subject: 'Q3 Growth Strategy Review',
    body: 'Hi Alice, I wanted to follow up on our Q3 growth strategy discussion. The team has prepared the updated projections and we are excited to share the results with you.',
    delaySeconds: 10,
  },
  {
    recipient_email: 'bob.smith@techstartup.io',
    subject: 'Partnership Proposal - ReachInbox x TechStartup',
    body: 'Dear Bob, Thank you for your interest in a partnership. We believe combining our email deliverability platform with your CRM would create tremendous value for both our customer bases.',
    delaySeconds: 20,
  },
  {
    recipient_email: 'carol.nguyen@enterprise.co',
    subject: 'Enterprise Plan Upgrade - Special Offer',
    body: 'Hi Carol, As a valued customer, we are offering you an exclusive 30% discount on our Enterprise plan upgrade. This includes advanced analytics, priority support, and custom integrations.',
    delaySeconds: 30,
  },
  {
    recipient_email: 'david.chen@marketingpro.com',
    subject: 'Webinar Invitation: Email Deliverability Best Practices',
    body: 'Hi David, You are invited to our upcoming webinar on email deliverability best practices. Join us on Friday at 2 PM EST to learn how top marketers achieve 99% inbox placement rates.',
    delaySeconds: 45,
  },
];

async function run() {
  console.log('='.repeat(60));
  console.log('🚀 Demo: Scheduling 4 emails with staggered delivery times');
  console.log('='.repeat(60));

  for (let i = 0; i < emails.length; i++) {
    const e = emails[i];
    const scheduledAt = new Date(Date.now() + e.delaySeconds * 1000).toISOString();

    console.log(`\n[${i+1}/4] Scheduling: "${e.subject}"`);
    console.log(`   To: ${e.recipient_email}`);
    console.log(`   Fires in: ${e.delaySeconds}s (${scheduledAt})`);

    const resp = await fetch(`${BASE}/api/emails/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient_email: e.recipient_email,
        subject: e.subject,
        body: e.body,
        scheduled_at: scheduledAt,
      }),
    });

    const data = await resp.json();
    if (resp.ok) {
      console.log(`   ✅ Scheduled! ID: ${data.email?.id || 'N/A'}, BullMQ delay: ${data.scheduling?.delaySeconds || 0}s`);
    } else {
      console.log(`   ❌ Error: ${data.message || JSON.stringify(data)}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📬 Listing all SCHEDULED emails...');
  console.log('='.repeat(60));

  const listResp = await fetch(`${BASE}/api/emails?status=SCHEDULED`);
  const listData = await listResp.json();
  console.log(`Found ${listData.count} scheduled email(s):`);
  for (const email of (listData.data || [])) {
    console.log(`  • [${email.status}] To: ${email.recipientEmail} — "${email.subject}" — fires at ${email.scheduledAt}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📤 Listing previously SENT emails...');
  console.log('='.repeat(60));

  const sentResp = await fetch(`${BASE}/api/emails?status=SENT`);
  const sentData = await sentResp.json();
  console.log(`Found ${sentData.count} sent email(s):`);
  for (const email of (sentData.data || []).slice(0, 5)) {
    console.log(`  • [${email.status}] To: ${email.recipientEmail} — "${email.subject}" — sent at ${email.sentAt}`);
    if (email.previewUrl) console.log(`    🔗 Ethereal preview: ${email.previewUrl}`);
  }
  if ((sentData.data || []).length > 5) {
    console.log(`  ... and ${sentData.data.length - 5} more`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🔍 Testing search API with query "Growth"...');
  console.log('='.repeat(60));

  const searchResp = await fetch(`${BASE}/api/emails/search?q=Growth`);
  const searchData = await searchResp.json();
  console.log(`Search returned ${searchData.count} result(s) (fallback: ${searchData.fallback || false}):`);
  for (const email of (searchData.data || [])) {
    console.log(`  • "${email.subject}" → ${email.recipientEmail} [${email.status}]`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('⏳ Waiting 55 seconds for all emails to be processed by the worker...');
  console.log('='.repeat(60));

  await new Promise(r => setTimeout(r, 55000));

  const finalResp = await fetch(`${BASE}/api/emails?status=SENT&limit=10`);
  const finalData = await finalResp.json();
  console.log(`\n📨 After waiting, ${finalData.count} email(s) now in SENT status:`);
  for (const email of (finalData.data || []).slice(0, 10)) {
    console.log(`  • [${email.status}] "${email.subject}" → ${email.recipientEmail}`);
    if (email.previewUrl) console.log(`    🔗 ${email.previewUrl}`);
  }

  console.log('\n✅ Demo complete!');
}

run().catch(console.error);
