import '../apps/backend/src/config/env';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSearchTest() {
  console.log('================================================================');
  console.log('🔍 Module 8: Elasticsearch & Database Fallback Search Test');
  console.log('================================================================');

  const senderId = 'snd_reachinbox_growth_001';
  const targetTime = new Date().toISOString();
  const uniqueKeyphrase = 'XyzzySpecialTag_' + Date.now();

  console.log(`[1/3] Scheduling 2 test emails with subject search token: "${uniqueKeyphrase}"...`);

  // Email 1
  const res1 = await fetch('http://127.0.0.1:5000/api/emails/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender_id: senderId,
      recipient_email: 'lead-search-1@acme-corp.io',
      subject: `Module 8 Test - ${uniqueKeyphrase} Alpha`,
      body: `This is email body containing secret keywords for ES index testing.`,
      scheduled_at: targetTime,
    }),
  });
  const data1 = await res1.json();
  console.log(`  ✅ Scheduled Email #1. ID: ${data1.email.id}`);

  // Email 2
  const res2 = await fetch('http://127.0.0.1:5000/api/emails/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender_id: senderId,
      recipient_email: 'lead-search-2@acme-corp.io',
      subject: `Module 8 Test - ${uniqueKeyphrase} Beta`,
      body: `This is second body representing the beta update.`,
      scheduled_at: targetTime,
    }),
  });
  const data2 = await res2.json();
  console.log(`  ✅ Scheduled Email #2. ID: ${data2.email.id}`);

  console.log(`\n[2/3] Waiting 4 seconds for Elasticsearch indexing...`);
  await sleep(4000);

  console.log(`\n[3/3] Querying search API: GET /api/emails/search?q=${uniqueKeyphrase}`);
  
  const searchRes = await fetch(`http://127.0.0.1:5000/api/emails/search?q=${uniqueKeyphrase}`);
  console.log(`  Response Status: ${searchRes.status} ${searchRes.statusText}`);
  const rawText = await searchRes.text();
  console.log(`  Response Body:`, rawText);
  const searchData = JSON.parse(rawText);

  console.log(`\n📊 Search Results:`);
  console.log(`  Total matches: ${searchData.count}`);
  console.log(`  Used Database Fallback? ${searchData.fallback}`);
  console.log('─'.repeat(120));

  searchData.data.forEach((e: any, index: number) => {
    console.log(
      `  Match #${index + 1} | ID: ${e.id} | Subject: "${e.subject}" | Recipient: <${e.recipientEmail}> | Status: ${e.status}`
    );
  });
  console.log('─'.repeat(120));

  if (searchData.count === 2) {
    console.log('\n✅ TEST PASSED: Successfully found both scheduled emails via search API!');
  } else {
    console.warn('\n⚠️ TEST WARNING: Did not find exactly 2 matching emails.');
  }
}

runSearchTest().catch(console.error);
