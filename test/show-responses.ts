import "dotenv/config";
import { create } from "../src/index";
import { Environment, PartyIdType } from "../src/common";

const PARTY_ID = "46733123454";

async function run() {
  const momo = create({ environment: Environment.SANDBOX, callbackHost: "example.com" });

  const collectionsPrimaryKey = process.env.COLLECTIONS_PRIMARY_KEY!;
  const disbursementsPrimaryKey = process.env.DISBURSEMENTS_PRIMARY_KEY!;
  const remittancePrimaryKey = process.env.REMITTANCE_PRIMARY_KEY!;

  console.log("--- 1. User Management Responses ---");
  const users = momo.Users({ primaryKey: collectionsPrimaryKey });
  let collectionsUserId = "";
  let collectionsApiKey = "";
  try {
    collectionsUserId = await users.create("example.com");
    console.log("users.create (Collections):", collectionsUserId);
    const apiUser = await users.getApiUser(collectionsUserId);
    console.log("users.getApiUser:", JSON.stringify(apiUser, null, 2));
    const creds = await users.login(collectionsUserId);
    collectionsApiKey = creds.apiKey;
    console.log("users.login:", JSON.stringify(creds, null, 2));
  } catch (e: any) {
    console.log("User Management Error:", e.name, e.message);
  }

  // Provision for Disbursements
  const usersD = momo.Users({ primaryKey: disbursementsPrimaryKey });
  const disbursementsUserId = await usersD.create("example.com");
  const disbursementsCreds = await usersD.login(disbursementsUserId);

  // Provision for Remittance
  const usersR = momo.Users({ primaryKey: remittancePrimaryKey });
  const remittanceUserId = await usersR.create("example.com");
  const remittanceCreds = await usersR.login(remittanceUserId);

  // Initialize Product Clients
  const collectionsClient = momo.Collections({
    primaryKey: collectionsPrimaryKey,
    userId: collectionsUserId,
    userSecret: collectionsApiKey,
  });
  
  const disbursementsClient = momo.Disbursements({
    primaryKey: disbursementsPrimaryKey,
    userId: disbursementsUserId,
    userSecret: disbursementsCreds.apiKey,
  });

  const remittanceClient = momo.Remittance({
    primaryKey: remittancePrimaryKey,
    userId: remittanceUserId,
    userSecret: remittanceCreds.apiKey,
  });

  console.log("\n--- 2. Collections Responses ---");
  const collectionEndpoints = [
    { name: "getBalance", fn: () => collectionsClient.getBalance() },
    { name: "isPayerActive", fn: () => collectionsClient.isPayerActive(PARTY_ID) },
    { name: "getBasicUserInfo", fn: () => collectionsClient.getBasicUserInfo(PartyIdType.MSISDN, PARTY_ID) },
    { name: "requestToPay", fn: () => collectionsClient.requestToPay({ amount: "10", currency: "EUR", externalId: "rtp-999", payer: { partyIdType: PartyIdType.MSISDN, partyId: PARTY_ID }, payerMessage: "msg", payeeNote: "note" }) },
    { name: "requestToWithdraw (V1)", fn: () => collectionsClient.requestToWithdraw({ amount: "5", currency: "EUR", externalId: "wit-v1", payee: { partyIdType: PartyIdType.MSISDN, partyId: PARTY_ID }, payerMessage: "v1", payeeNote: "v1" }) },
    { name: "requestToWithdrawV2 (V2)", fn: () => collectionsClient.requestToWithdrawV2({ amount: "5", currency: "EUR", externalId: "wit-v2", payee: { partyIdType: PartyIdType.MSISDN, partyId: PARTY_ID }, payerMessage: "v2", payeeNote: "v2" }) },
  ];

  for (const endpoint of collectionEndpoints) {
    try {
      const res = await endpoint.fn();
      console.log(`collections.${endpoint.name}: SUCCESS`, JSON.stringify(res, null, 2));
    } catch (e: any) {
      console.log(`collections.${endpoint.name}: ERROR`, e.name, e.message);
    }
  }

  console.log("\n--- 3. Disbursements Responses ---");
  const disbursementEndpoints = [
    { name: "getBalance", fn: () => disbursementsClient.getBalance() },
    { name: "isPayerActive", fn: () => disbursementsClient.isPayerActive(PARTY_ID) },
    { name: "getBasicUserInfo", fn: () => disbursementsClient.getBasicUserInfo(PartyIdType.MSISDN, PARTY_ID) },
    { name: "transfer", fn: () => disbursementsClient.transfer({ amount: "10", currency: "EUR", externalId: "trans-999", payee: { partyIdType: PartyIdType.MSISDN, partyId: PARTY_ID }, payerMessage: "msg", payeeNote: "note" }) },
    { name: "deposit (V1)", fn: () => disbursementsClient.deposit({ amount: "5", currency: "EUR", externalId: "dep-v1", payee: { partyIdType: PartyIdType.MSISDN, partyId: PARTY_ID }, payerMessage: "v1", payeeNote: "v1" }) },
    { name: "depositV2 (V2)", fn: () => disbursementsClient.depositV2({ amount: "5", currency: "EUR", externalId: "dep-v2", payee: { partyIdType: PartyIdType.MSISDN, partyId: PARTY_ID }, payerMessage: "v2", payeeNote: "v2" }) },
  ];

  for (const endpoint of disbursementEndpoints) {
    try {
      const res = await endpoint.fn();
      console.log(`disbursements.${endpoint.name}: SUCCESS`, JSON.stringify(res, null, 2));
    } catch (e: any) {
      console.log(`disbursements.${endpoint.name}: ERROR`, e.name, e.message);
    }
  }

  console.log("\n--- 4. Remittance Responses ---");
  const remittanceEndpoints = [
    { name: "getBalance", fn: () => remittanceClient.getBalance() },
    { name: "isPayerActive", fn: () => remittanceClient.isPayerActive(PARTY_ID) },
    { name: "getBasicUserInfo", fn: () => remittanceClient.getBasicUserInfo(PARTY_ID) },
    { name: "transfer", fn: () => remittanceClient.transfer({ amount: "10", currency: "EUR", externalId: "remit-999", payee: { partyIdType: PartyIdType.MSISDN, partyId: PARTY_ID }, payerMessage: "msg", payeeNote: "note" }) },
    { name: "getUserInfoWithConsent", fn: () => remittanceClient.getUserInfoWithConsent() },
  ];

  for (const endpoint of remittanceEndpoints) {
    try {
      const res = await endpoint.fn();
      console.log(`remittance.${endpoint.name}: SUCCESS`, JSON.stringify(res, null, 2));
    } catch (e: any) {
      console.log(`remittance.${endpoint.name}: ERROR`, e.name, e.message);
    }
  }
}

run().catch(console.error);
