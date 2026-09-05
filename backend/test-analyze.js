import http from "http";

async function testDocumentAnalyze() {
  console.log("🧪 [Analyze Test] Testing in-memory document upload & analysis...");

  const sampleContractText = `
RESIDENTIAL RENTAL AGREEMENT
This agreement is made between Landlord (Owner) and Tenant (Om Mehta).

1. PREMISES AND TERM
The term of this lease is for 11 months commencing on 01 October 2026.

4. RENT AND PAYMENT SCHEDULE
The Tenant agrees to pay monthly rent of ₹25,000 on or before the 5th of each calendar month.
Failure to pay within 5 days incurs a late fee of ₹1,000 per day.

6. SECURITY DEPOSIT
The Tenant shall pay a security deposit of ₹50,000. It shall be returned within 30 days of vacation,
subject to verification of premises and deductions permitted under Clause 18.

7. RENEWAL AND CONTINUATION
The agreement may be renewed by mutual written consent at least 30 days prior to expiry date.
Landlord reserves unilateral right to adjust rent upward by 10% upon renewal.

12. TERMINATION AND NOTICE PERIOD
Either party may terminate this agreement by serving a 60-day written notice to the other party.
Failure to provide the 60-day written notice will result in immediate forfeiture of security deposit
and trigger the liquidated damages penalty under Clause 21.

18. SECURITY DEPOSIT DEDUCTIONS
Deductions from the deposit may only be made for structural damages, unpaid electricity/water dues,
or failure to restore unauthorized modifications. Normal wear and tear, including minor nail holes,
shall not be grounds for deposit deduction.

21. EARLY EXIT PENALTY
In the event that the Tenant terminates this lease prior to the end of the term without the 60-day written notice,
the Tenant shall pay liquidated damages equivalent to ₹20,000 as early exit compensation.
  `.trim();

  const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
  let body = "";
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="recipientEmail"\r\n\r\n`;
  body += `om.mehta@example.com\r\n`;
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="file"; filename="Rental_Agreement_2026.txt"\r\n`;
  body += `Content-Type: text/plain\r\n\r\n`;
  body += sampleContractText + "\r\n";
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
        console.log(`Status: ${res.statusCode}`);
        try {
          const json = JSON.parse(data);
          console.log("✅ Success:", json.success);
          console.log("Session ID:", json.sessionId);
          console.log("Document Type:", json.documentType);
          console.log("Fairness Score:", json.summary?.fairnessScore);
          console.log("Risk Scorecard:", json.riskScorecard?.verdict, json.riskScorecard?.breakdown);
          console.log("Fixed Commitments:", json.financialLedger?.fixedCommitments?.length);
          console.log("Contingent Liabilities:", json.financialLedger?.contingentLiabilities?.length);
          console.log("Clauses Extracted:", json.clauses?.length);
          console.log("DAG Nodes / Edges:", json.dag?.nodes?.length, "/", json.dag?.edges?.length);
          console.log("Tasks Detected & Scheduled:", json.tasksDetected);
        } catch (e) {
          console.error("Parse Error:", data);
        }
      });
    }
  );

  req.write(body);
  req.end();
}

testDocumentAnalyze().catch(console.error);
