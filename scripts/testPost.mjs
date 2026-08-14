const url = "http://localhost:5174/api/voice";
(async () => {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hello" }),
    });
    const text = await res.text();
    console.log("STATUS", res.status);
    console.log("BODY", text);
  } catch (e) {
    console.error("ERR", e);
    process.exit(1);
  }
})();
