import * as momo from "../src";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const { Disbursements } = momo.create({
  callbackHost: requireEnv("CALLBACK_HOST"),
});

const disbursements = Disbursements({
  userSecret: requireEnv("DISBURSEMENTS_USER_SECRET"),
  userId: requireEnv("DISBURSEMENTS_USER_ID"),
  primaryKey: requireEnv("DISBURSEMENTS_PRIMARY_KEY"),
});

async function main(): Promise<void> {
  const partyId = "256776564739";
  const partyIdType = momo.PayerType.MSISDN;

  const isActive = await disbursements.isPayerActive(partyId, partyIdType);
  console.log("Is Active?", isActive);

  if (!isActive) {
    throw new Error("Party not active");
  }

  const transactionId = await disbursements.transfer({
    amount: "100",
    currency: "EUR",
    externalId: "947354",
    payee: {
      partyIdType,
      partyId,
    },
    payerMessage: "testing",
    payeeNote: "hello",
    callbackUrl: process.env.CALLBACK_URL || "https://75f59b50.ngrok.io",
  });

  console.log({ transactionId });

  const transaction = await disbursements.getTransaction(transactionId);
  console.log({ transaction });

  const accountBalance = await disbursements.getBalance();
  console.log({ accountBalance });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
