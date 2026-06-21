import fetch from "node-fetch";

async function probe() {
  const urls = [
    "https://jolie-co.com/products/sunvera",
    "https://jolie-co.com/products/jolie-sunvera",
    "https://jolie-co.com/products/sunvera-moissanite-ring",
    "https://jolie-co.com/products/sunvera-ring",
  ];

  for (const baseUrl of urls) {
    const jsUrl = baseUrl + ".js";
    console.log(`Probing: ${jsUrl}`);
    try {
      const res = await fetch(jsUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
        }
      });
      console.log(` -> Status: ${res.status}`);
      if (res.ok) {
        const text = await res.text();
        console.log(` -> Body Starts With: ${text.substring(0, 200)}`);
        if (text.includes("title") || text.includes("id")) {
          console.log(`FOUND STABLE URL: ${baseUrl}`);
          const parsed = JSON.parse(text);
          console.log("Parsed Title:", parsed.title);
          console.log("Parsed Price:", parsed.price || (parsed.variants && parsed.variants[0]?.price));
          console.log("Parsed Images:", parsed.images || parsed.featured_image);
          break;
        }
      }
    } catch (err: any) {
      console.log(` -> Error: ${err.message}`);
    }
  }
}

probe();
