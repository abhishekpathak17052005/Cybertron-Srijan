import http from "http";

function sendQuery(sessionId, question) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ sessionId, question });
    const req = http.request(
      {
        hostname: "localhost",
        port: 5000,
        path: "/api/chat/query",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(data) });
          } catch (e) {
            reject(new Error(`Parse error: ${data}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log("🧪 Testing Grounded RAG Copilot across various legal domains...\n");

  const testCases = [
    {
      name: "1. Security Deposit Deductions (Repainting / Wear & Tear)",
      question: "Can the landlord deduct money from my security deposit for repainting or normal wear and tear?",
    },
    {
      name: "2. Monthly Rent & Due Date",
      question: "How much is the monthly rent and when is it due each month?",
    },
    {
      name: "3. Early Termination & Penalty Notice",
      question: "What happens if I terminate the agreement without 60 days notice?",
    },
    {
      name: "4. Explicit Clause Lookup (Clause 07)",
      question: "What are the terms of Clause 07 regarding renewal?",
    },
  ];

  for (const tc of testCases) {
    console.log(`--------------------------------------------------`);
    console.log(`Case: ${tc.name}`);
    console.log(`Q: "${tc.question}"`);
    try {
      const res = await sendQuery("sess_demo_default", tc.question);
      console.log(`Status: ${res.status}`);
      console.log(`Answer:\n${res.json.answer}`);
      console.log(`Citations:`, res.json.citations?.map((c) => `[${c.clauseId} (p. ${c.page})]`).join(", "));
      console.log(`Graph Traversal:`, res.json.graphPath?.join(" ➔ ") || "Direct");
    } catch (err) {
      console.error(`❌ Error in ${tc.name}:`, err.message);
    }
    console.log(`\n`);
  }
}

runTests().catch(console.error);
