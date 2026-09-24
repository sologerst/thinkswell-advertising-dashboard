import { createDb, runMigrations } from "@/lib/db/connect";

createDb()
  .then(runMigrations)
  .then(() => {
    console.log("✓ migrations applied");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
