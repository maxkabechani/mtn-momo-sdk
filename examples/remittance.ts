import * as momo from "../src";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const { Remittance } = momo.create({
  callbackHost: requireEnv("CALLBACK_HOST"),
});

const remittance = Remittance({
  userSecret: requireEnv("REMITTANCE_USER_SECRET"),
  userId: requireEnv("REMITTANCE_USER_ID"),
  primaryKey: requireEnv("REMITTANCE_PRIMARY_KEY"),
});

async function main(): Promise<void> {
  const payee = {
    partyIdType: momo.PayerType.MSISDN,
    partyId: "256774290781",
  };

  const transferId = await remittance.transfer({
    amount: "100",
    currency: "EUR",
    externalId: `remit-${Date.now()}`,
    payee,
    payerMessage: "Cross-border transfer",
    payeeNote: "Remittance example",
  });
  console.log({ transferId });

  const transfer = await remittance.getTransaction(transferId);
  console.log({ transfer });

  const balance = await remittance.getBalance();
  console.log({ balance });

  const isActive = await remittance.isPayerActive(
    payee.partyId,
    payee.partyIdType,
  );
  console.log({ isActive });

  const userInfo = await remittance.getUserInfoWithConsent();
  console.log({ userInfo });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
