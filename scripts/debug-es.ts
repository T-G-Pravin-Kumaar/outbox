import { esClient } from '../apps/backend/src/lib/elasticsearch';

async function debug() {
  const info = await esClient.info();
  console.log("ES Info:", info);

  try {
    const response = await fetch('http://127.0.0.1:9200/_cat/indices?format=json');
    console.log("ES Raw Response Status:", response.status);
    const body = await response.json();
    console.log("ES Raw Response Body:", JSON.stringify(body, null, 2));
  } catch (err: any) {
    console.error("ES Raw Error:", err.message);
  }
}

debug().catch(console.error);
