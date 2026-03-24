import * as momo from "../src";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const { Collections } = momo.create({
  callbackHost: requireEnv("CALLBACK_HOST"),
});

const collections = Collections({
  userSecret: requireEnv("COLLECTIONS_USER_SECRET"),
  userId: requireEnv("COLLECTIONS_USER_ID"),
  primaryKey: requireEnv("COLLECTIONS_PRIMARY_KEY"),
});

async function main(): Promise<void> {
  const transactionId = await collections.requestToPay({
    amount: "50",
    currency: "EUR",
    externalId: "123456",
    payer: {
      partyIdType: momo.PayerType.MSISDN,
      partyId: "256774290781",
    },
    payerMessage: "testing",
    payeeNote: "hello",
  });

  console.log({ transactionId });

  const transaction = await collections.getTransaction(transactionId);
  console.log({ transaction });

  const accountBalance = await collections.getBalance();
  console.log({ accountBalance });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
