async function testDashboard() {
  console.log("Testing dashboard unauthorized request...");
  const res1 = await fetch("http://127.0.0.1:5000/admin/queues");
  console.log("Status without credentials:", res1.status); // Expect 401
  const text1 = await res1.text();
  console.log("Body without credentials:", text1);
  console.log("Headers:", res1.headers.get("WWW-Authenticate"));

  console.log("\nTesting dashboard authorized request...");
  const auth = Buffer.from("admin:admin").toString("base64");
  const res2 = await fetch("http://127.0.0.1:5000/admin/queues", {
    headers: {
      "Authorization": `Basic ${auth}`
    }
  });
  console.log("Status with credentials:", res2.status); // Expect 200 or 302
  console.log("Response URL:", res2.url);
}

testDashboard().catch(console.error);
