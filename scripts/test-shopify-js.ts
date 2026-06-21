async function test() {
  const urls = [
    "https://packagefree-shop.com/products/natural-dental-floss.js",
    "https://kyliecosmetics.com/products/high-gloss.js",
    "https://taylorstitch.com/products/the-jack-in-blue-everyday-oxford.js",
  ];
  for (const url of urls) {
    console.log("Fetching live Shopify JSON:", url);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      console.log("Status for", url, ":", res.status);
      if (res.ok) {
        const json = await res.json();
        console.log("SUCCESS! Keys:", Object.keys(json));
        console.log("Title:", json.title);
        console.log("Price:", json.price);
        break;
      }
    } catch (err: any) {
      console.error("FAILED live fetch:", err.message);
    }
  }
}
test();
