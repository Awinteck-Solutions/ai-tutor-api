import mongoose from "mongoose";
import { env } from "../src/config/env";
import { ensureQuizIndexes } from "../src/database/quizIndexes";

async function main() {
  await mongoose.connect(env.dbUrl);
  await ensureQuizIndexes();
  const indexes = await mongoose.connection.collection("quizzes").indexes();
  console.log(
    indexes.map((i) => ({ name: i.name, key: i.key, unique: i.unique }))
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
