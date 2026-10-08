export function assertCanSeed(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === "production" && env.ALLOW_SEED !== "1") {
    throw new Error("Refusing to seed production. Set ALLOW_SEED=1 if you really mean to replace the data.");
  }
}
