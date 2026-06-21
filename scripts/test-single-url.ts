import { GoogleGenAI, Type } from "@google/genai";

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No Gemini API key found!");
    process.exit(1);
  }
  const ai = new GoogleGenAI({ apiKey });
  const url = "https://scandikitchen.co.uk/product/estrella-dillchips-dill-crisps-275g/";
  
  console.log("Testing urlContext tool with Gemini on WooCommerce URL:", url);
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Extract product details for ${url}`,
      config: {
        systemInstruction: "You are a professional retail and ecommerce database analyzer. Extract the product details and return strict JSON conforming to the schema.",
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["title", "price", "currency"],
          properties: {
            title: { type: Type.STRING },
            price: { type: Type.NUMBER },
            currency: { type: Type.STRING },
          }
        },
        tools: [{ urlContext: {} }]
      }
    });
    console.log("SUCCESS! Response text:");
    console.log(response.text);
  } catch (err: any) {
    console.error("FAILED matching URL context with schema:", err.message || err);
  }
}

run();
