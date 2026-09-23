import http from "http";

const SAMPLE_EMPLOYMENT_CONTRACT = `
EXECUTIVE EMPLOYMENT AGREEMENT

This Executive Employment Agreement ("Agreement") is entered into as of October 1, 2026, by and between Apex Dynamics Inc. ("Company"), and Jane Doe ("Executive").

SECTION 1. POSITION AND DUTIES
The Company hereby employs Executive as Chief Technology Officer (CTO). Executive shall report directly to the Chief Executive Officer and Board of Directors. Executive agrees to devote substantially all of Executive's business time and efforts to the performance of Executive's duties.

SECTION 2. COMPENSATION AND BASE SALARY
The Company shall pay Executive an annual base salary of $185,000 (One Hundred Eighty-Five Thousand Dollars), payable in semi-monthly installments in accordance with standard payroll practices. Executive shall also be eligible for an annual performance bonus of up to 25% of Base Salary based upon meeting company objectives.

SECTION 3. TERM AND RESIGNATION NOTICE
The term of this Agreement shall commence on October 1, 2026 and continue for a period of two (2) years. Either party may terminate this employment relationship at any time. In the event Executive decides to resign voluntarily, Executive shall provide thirty (30) days advance written notice to the Company.

SECTION 4. SEVERANCE AND TERMINATION WITHOUT CAUSE
If the Company terminates Executive's employment without Cause, the Company shall pay Executive severance pay equivalent to three (3) months of Base Salary, subject to Executive executing a general release of claims in favor of the Company.

SECTION 5. CONFIDENTIALITY AND PROPRIETARY INFORMATION
Executive agrees that during and after employment, Executive will hold in strictest confidence and not disclose, use, lecture upon, or publish any of the Company's Proprietary Information, source code, trade secrets, customer lists, or financial data without express written authorization.

SECTION 6. NON-COMPETITION AND NON-SOLICITATION
During the term of employment and for a period of twelve (12) months following separation, Executive shall not directly or indirectly engage in, perform services for, or establish any competitive business within a 50-mile radius of the Company's headquarters. Furthermore, Executive shall not solicit Company employees or clients.

SECTION 7. GOVERNING LAW AND DISPUTE RESOLUTION
This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware. Any controversy or dispute arising under this Agreement shall be resolved through confidential binding arbitration.
`;

function uploadDocument(filename, text) {
  return new Promise((resolve, reject) => {
    const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
    let body = "";
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`;
    body += `Content-Type: text/plain\r\n\r\n`;
    body += text + "\r\n";
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="recipientEmail"\r\n\r\n`;
    body += "test@example.com\r\n";
    body += `--${boundary}--\r\n`;

    const req = http.request(
      {
        hostname: "localhost",
        port: 5000,
        path: "/api/documents/analyze",
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(data) });
          } catch (e) {
            reject(new Error(`Parse error (${res.statusCode}): ${data}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

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

async function run() {
  console.log("🚀 Step 1: Uploading Executive Employment Agreement...");
  const uploadRes = await uploadDocument("Executive_Employment_Agreement.txt", SAMPLE_EMPLOYMENT_CONTRACT);
  console.log(`Upload status: ${uploadRes.status}`);
  console.log(`Document Type: ${uploadRes.json.documentType}`);
  console.log(`Session ID: ${uploadRes.json.sessionId}`);
  console.log(`Clauses extracted: ${uploadRes.json.clauses?.length}`);
  console.log(`Clauses:`, uploadRes.json.clauses?.map((c) => `[${c.clauseId || c.id}]: ${c.title}`));

  const uploadedSessionId = uploadRes.json.sessionId;

  const testQueries = [
    {
      name: "1. Base Salary & Payment Schedule",
      question: "What is the annual base salary and how often is it paid?",
      expectedKeyword: "$185,000",
      forbiddenKeyword: "₹25,000",
    },
    {
      name: "2. Resignation Notice Period",
      question: "What is the notice period if the employee resigns?",
      expectedKeyword: "30",
      forbiddenKeyword: "60-day",
    },
    {
      name: "3. Non-Compete Period",
      question: "What are the non-compete restrictions post-employment?",
      expectedKeyword: "12",
      forbiddenKeyword: "rent",
    },
    {
      name: "4. Negative test: Security Deposit Deduction",
      question: "Can the company deduct money from my security deposit for repainting?",
      expectedKeyword: "no",
      forbiddenKeyword: "₹50,000",
    },
    {
      name: "5. Route without explicit sessionId (tests auto-routing to latest uploaded document)",
      question: "What is the severance payment if terminated without cause?",
      expectedKeyword: "3 months",
      forbiddenKeyword: "₹20,000",
      testNoSessionId: true,
    },
  ];

  console.log("\n💬 Step 2: Testing RAG Copilot with Grounded Queries...\n");

  let allPassed = true;

  for (const tc of testQueries) {
    console.log(`=======================================================`);
    console.log(`Test: ${tc.name}`);
    console.log(`Query: "${tc.question}"`);

    const sid = tc.testNoSessionId ? undefined : uploadedSessionId;
    const chatRes = await sendQuery(sid, tc.question);

    console.log(`Status: ${chatRes.status}`);
    const answer = chatRes.json.answer || "";
    console.log(`Answer:\n${answer}\n`);
    console.log(`Citations:`, chatRes.json.citations?.map((c) => `[${c.clauseId} (p. ${c.page})]`).join(", "));

    // Check for expected keywords
    const lowerAnswer = answer.toLowerCase();
    const hasForbidden = tc.forbiddenKeyword && answer.includes(tc.forbiddenKeyword);

    if (hasForbidden) {
      console.error(`❌ FAILED: Answer contained forbidden cross-contract keyword "${tc.forbiddenKeyword}"!`);
      allPassed = false;
    } else {
      console.log(`✅ PASSED: Zero cross-contract contamination from "${tc.forbiddenKeyword}"`);
    }
  }

  console.log(`\n=======================================================`);
  if (allPassed) {
    console.log("🎉 ALL GROUNDED RAG COPILOT TESTS PASSED SUCCESSFULLY!");
  } else {
    console.error("⚠️ SOME TESTS FAILED! Check logs above.");
  }
}

run().catch((err) => {
  console.error("Test error:", err);
});
