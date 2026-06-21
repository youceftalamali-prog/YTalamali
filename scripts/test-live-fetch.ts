async function testFetch() {
  const urls = [
    "https://scandikitchen.co.uk/product/estrella-dillchips-dill-crisps-275g/",
    "https://scandikitchen.co.uk/product/olw-cheez-doodles-160g/",
  ];
  for (const url of urls) {
    console.log("Fetching url:", url);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36"
        }
      });
      console.log(` -> Status: ${res.status}`);
    } catch (err: any) {
      console.log(` -> Failed: ${err.message}`);
    }
  }
}
testFetch();
