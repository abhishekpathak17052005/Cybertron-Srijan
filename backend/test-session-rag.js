import http from "http";

async function testSessionRAG() {
  const sessionId = "sess_1788591637817_7dkql8J6";
  const postData = JSON.stringify({
    sessionId,
    question: "What happens if I terminate the agreement without 60 days notice?",
  });

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
        console.log(`Status: ${res.statusCode}`);
        const json = JSON.parse(data);
        console.log("RAG Answer:", json.answer);
        console.log("Citations:", json.citations);
        console.log("Graph Path:", json.graphPath);
      });
    }
  );

  req.write(postData);
  req.end();
}

testSessionRAG().catch(console.error);
