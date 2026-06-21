import * as momo from "../src";
import { logSafeError } from "./safe-error.ts";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const { Users } = momo.create({
  callbackHost: requireEnv("CALLBACK_HOST"),
});

const users = Users({
  primaryKey: requireEnv("SANDBOX_PRIMARY_KEY"),
});

async function main(): Promise<void> {
  const userId = await users.create(requireEnv("CALLBACK_HOST"));
  console.log({ userId });

  const user = await users.getApiUser(userId);
  console.log({ providerCallbackHost: user.providerCallbackHost });

  await users.login(userId);
  console.log("Sandbox API key created. Store it securely; it is not printed.");
}

main().catch((error) => {
  logSafeError(error);
  process.exitCode = 1;
});
