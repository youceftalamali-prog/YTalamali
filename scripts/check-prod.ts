async function checkProd() {
  try {
    const res = await fetch("https://aurapost-ai-v5nk7xhtoa-nw.a.run.app/api/health");
    console.log("Status:", res.status);
    console.log("Headers:", Array.from(res.headers.entries()));
    const text = await res.text();
    console.log("Response body:", text);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}
checkProd();
