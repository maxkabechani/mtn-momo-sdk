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
  const payee = {
    partyIdType: momo.PayerType.MSISDN,
    partyId: "256776564739",
  };

  const depositId = await disbursements.depositV2({
    amount: "100",
    currency: "EUR",
    externalId: `dep-${Date.now()}`,
    payee,
    payerMessage: "Deposit from platform",
    payeeNote: "v2 create endpoint",
  });
  console.log({ depositId });

  const deposit = await disbursements.getDeposit(depositId);
  console.log({ deposit });

  const refundId = await disbursements.refundV2({
    amount: "50",
    currency: "EUR",
    externalId: `ref-${Date.now()}`,
    payerMessage: "Refund sample",
    payeeNote: "v2 create endpoint",
    referenceIdToRefund: depositId,
  });
  console.log({ refundId });

  const refund = await disbursements.getRefund(refundId);
  console.log({ refund });

  const basicUserInfo = await disbursements.getBasicUserInfo(
    momo.PayerType.MSISDN,
    payee.partyId,
  );
  console.log({ basicUserInfo });

  const currencyBalance = await disbursements.getBalanceInCurrency("EUR");
  console.log({ currencyBalance });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
