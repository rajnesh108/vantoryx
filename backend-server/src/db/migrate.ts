import fs from "fs";
import path from "path";
import { pool } from "./pool";

export async function migrate(): Promise<void> {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
}
