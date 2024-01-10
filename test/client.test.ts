import { TipLink } from "../src";
import { TipLinkClient } from "../src";

const API_KEY = process.env["API_KEY"] || "";
const TEST_VERSION = 1;

test("Create Valid Client", async () => {
  if(!API_KEY) {
    return;
  }
  const client = await TipLinkClient.init(API_KEY, TEST_VERSION);
  expect(client.apiKey).toBe(API_KEY);
  expect(client.version).toBe(TEST_VERSION);
  expect(client.publicKey).not.toBe(null);
})

test("Create Campaign", async () => {
  if(!API_KEY) {
    return;
  }
  const TEST_CAMPAIGN_NAME = "Test Campaign (from jest)";
  const TEST_CAMPAIGN_DESCRIPTION = "Test description";
  const client = await TipLinkClient.init(API_KEY, TEST_VERSION);
  const campaign = await client.campaigns.create({name: TEST_CAMPAIGN_NAME, description: TEST_CAMPAIGN_DESCRIPTION, imageUrl: "", active: true});

  expect(campaign.id).not.toBe(null);
  expect(campaign.encryptionSalt).not.toBe(null);
  expect(campaign.encryptionSalt).not.toBe('');
  expect(campaign.name).toBe(TEST_CAMPAIGN_NAME);
})


test("Create Campaign with Entries", async () => {
  if(!API_KEY) {
    return;
  }
  const TEST_CAMPAIGN_NAME = "Test Campaign (from jest)";
  const TEST_CAMPAIGN_DESCRIPTION = "Test description";
  const client = await TipLinkClient.init(API_KEY, TEST_VERSION);
  const campaign = await client.campaigns.create({name: TEST_CAMPAIGN_NAME, description: TEST_CAMPAIGN_DESCRIPTION, imageUrl: "", active: true});


  const tiplink = await TipLink.create();
  const tiplink2 = await TipLink.create();

  const entry_resp = await campaign.addEntries([tiplink, tiplink2]);
  expect(entry_resp).toBe(true);
});

test("Campaign Basic Analytics", async () => {
  if(!API_KEY) {
    return;
  }
  const TEST_CAMPAIGN_NAME = "Test Campaign (from jest)";
  const TEST_CAMPAIGN_DESCRIPTION = "Test description";
  const client = await TipLinkClient.init(API_KEY, TEST_VERSION);
  const campaign = await client.campaigns.create({name: TEST_CAMPAIGN_NAME, description: TEST_CAMPAIGN_DESCRIPTION, imageUrl: "", active: true});

  const tiplink = await TipLink.create();
  const tiplink2 = await TipLink.create();

  const entry_resp = await campaign.addEntries([tiplink, tiplink2]);
  expect(entry_resp).toBe(true);

  const initial_analytics = await campaign.getAnalytics();

  expect(initial_analytics.total).toBe(2);
  expect(initial_analytics.event_type_counts.length).toBe(1);
  expect(initial_analytics.event_type_counts[0]["event_type"]).toBe("CREATED");
  expect(initial_analytics.event_type_counts[0]["count"]).toBe("2");

  const pubK = tiplink.keypair.publicKey;
  const pubK2 = tiplink2.keypair.publicKey;

  const analytics_payload = [
    {
      event: "ACCESSED",
      public_key: pubK,
    },
    {
      event: "CLAIMED",
      public_key: pubK,
    },
    {
      event: "ACCESSED",
      public_key: pubK2,
    },
  ];

  await client.fetch("analytics", null, analytics_payload, "POST");

  const adjust_analytics = await campaign.getAnalytics();

  expect(adjust_analytics.total).toBe(2);
  expect(adjust_analytics.event_type_counts.length).toBe(3);
  expect(adjust_analytics.event_type_counts[0]["event_type"]).toBe("CREATED");
  expect(adjust_analytics.event_type_counts[0]["count"]).toBe("2");
  expect(adjust_analytics.event_type_counts[1]["event_type"]).toBe("ACCESSED");
  expect(adjust_analytics.event_type_counts[1]["count"]).toBe("2");
  expect(adjust_analytics.event_type_counts[2]["event_type"]).toBe("CLAIMED");
  expect(adjust_analytics.event_type_counts[2]["count"]).toBe("1");
})

test("Create Dispenser for Campaign", async () => {
  if(!API_KEY) {
    return;
  }
  const TEST_CAMPAIGN_NAME = "Test Campaign (from jest)";
  const TEST_CAMPAIGN_DESCRIPTION = "Test description";
  const client = await TipLinkClient.init(API_KEY, TEST_VERSION);
  const campaign = await client.campaigns.create({name: TEST_CAMPAIGN_NAME, description: TEST_CAMPAIGN_DESCRIPTION, imageUrl: "", active: true});


  const tiplink = await TipLink.create();
  const tiplink2 = await TipLink.create();

  const entry_resp = await campaign.addEntries([tiplink, tiplink2]);
  expect(entry_resp).toBe(true);

  const dispenser = await campaign.dispensers.create({useCaptcha: false, useFingerprint: false, unlimitedClaims: false});
  expect(dispenser.url.hash).toBe("#" + campaign.encryptionKey);
})
