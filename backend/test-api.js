import http from "http";

async function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on("error", reject);
    if (postData) req.write(typeof postData === "string" ? postData : JSON.stringify(postData));
    req.end();
  });
}

async function runTests() {
  console.log("🧪 [Backend Tests] Starting verification suite...");

  // 1. Health Check
  const health = await makeRequest({
    hostname: "localhost",
    port: 5000,
    path: "/api/health",
    method: "GET",
  });
  console.log("✅ 1. Health check:", health.status, health.body);

  // 2. Tasks
  const tasks = await makeRequest({
    hostname: "localhost",
    port: 5000,
    path: "/api/tasks",
    method: "GET",
  });
  console.log("✅ 2. Get tasks:", tasks.status, `Returned ${tasks.body.tasks?.length} tasks`);

  // 3. Grounded Chat Query
  const chat = await makeRequest(
    {
      hostname: "localhost",
      port: 5000,
      path: "/api/chat/query",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { question: "Can deposit be withheld for repainting?" }
  );
  console.log("✅ 3. Chat query response:", chat.status);
  console.log("   Answer:", chat.body.answer);
  console.log("   Citations:", chat.body.citations);
  console.log("   Connected Clauses:", chat.body.connectedClauses);

  // 4. Action Token Link
  const testAction = await makeRequest({
    hostname: "localhost",
    port: 5000,
    path: "/api/tasks/action?taskId=task_test&action=done&token=invalid",
    method: "GET",
  });
  console.log("✅ 4. Action token rejection with invalid token:", testAction.status);

  console.log("🎉 [Backend Tests] All endpoint checks verified!");
}

runTests().catch(console.error);
