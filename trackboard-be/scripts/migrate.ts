import { db } from "../src/lib/db/client.ts";

const d = await db();
console.log(`migrations applied on ${d.kind}`);
await d.close();
