import fetch from "node-fetch";

async function inspectLive() {
  const liveUrl = "https://aurapost-ai-v5nk7xhtoa-nw.a.run.app";
  console.log(`Querying live products from: ${liveUrl}/api/products`);
  try {
    const res = await fetch(`${liveUrl}/api/products`);
    console.log(`Status: ${res.status}`);
    if (res.ok) {
      const json = await res.json();
      console.log("Live Products in DB:", JSON.stringify(json, null, 2));
    } else {
      console.log("Error response:", await res.text());
    }
  } catch (err: any) {
    console.log("Failed to query live deployment:", err.message);
  }
}

inspectLive();
