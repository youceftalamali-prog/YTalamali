import fs from "fs";
import path from "path";
import initSqlJs from "sql.js";

async function inspect() {
  const wasmPath = path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm");
  const wasmBinary = fs.readFileSync(wasmPath);
  const SQL = await initSqlJs({ wasmBinary: wasmBinary as any });
  
  const dbPath = path.join(process.cwd(), "storage", "aurapost.db");
  if (!fs.existsSync(dbPath)) {
    console.log("Database file does not exist at", dbPath);
    return;
  }
  
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);
  
  console.log("--- TABLE SCHEMAS ---");
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
  console.log(JSON.stringify(tables, null, 2));
  
  console.log("--- LATEST IMPORT OPERATIONS ---");
  const imports = db.exec("SELECT * FROM import_operations LIMIT 10");
  console.log(JSON.stringify(imports, null, 2));

  console.log("--- LATEST PRODUCTS ---");
  const products = db.exec("SELECT id, title, vendor, price, currency, availability, created_at, images FROM products ORDER BY created_at DESC LIMIT 10");
  console.log(JSON.stringify(products, null, 2));

  console.log("--- SEARCHING FOR JOLIE/SUNVERA/MOISSANITE/RING ---");
  const matchedProducts = db.exec("SELECT * FROM products WHERE title LIKE '%Jolie%' OR title LIKE '%Sunvera%' OR title LIKE '%Moissanite%' OR title LIKE '%Ring%' OR description LIKE '%Moissanite%'");
  console.log(JSON.stringify(matchedProducts, null, 2));
  
  console.log("--- SEARCHING FOR PRODUCTS WITH HIGH PRICE OR UNUSUAL PLACEMENT ---");
  const highPrice = db.exec("SELECT id, title, price, currency, created_at FROM products WHERE price > 1000");
  console.log(JSON.stringify(highPrice, null, 2));
}

inspect().catch(console.error);
