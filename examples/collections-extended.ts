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
  const payee = {
    partyIdType: momo.PayerType.MSISDN,
    partyId: "256774290781",
  };

  const withdrawalId = await collections.requestToWithdraw({
    amount: "50",
    currency: "EUR",
    externalId: `wd-${Date.now()}`,
    payee,
    payerMessage: "Withdrawal request",
    payeeNote: "Collections extended example",
  });
  console.log({ withdrawalId });

  const withdrawal = await collections.getWithdrawal(withdrawalId);
  console.log({ withdrawal });

  await collections.sendDeliveryNotification(withdrawalId, {
    notificationMessage: "Goods delivered",
  });
  console.log("Delivery notification sent");

  const basicUserInfo = await collections.getBasicUserInfo(
    momo.PayerType.MSISDN,
    payee.partyId,
  );
  console.log({ basicUserInfo });

  const currencyBalance = await collections.getBalanceInCurrency("EUR");
  console.log({ currencyBalance });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
