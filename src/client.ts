import { nanoid } from "nanoid";

import { TipLink } from './index';
import { generateRandomSalt, generateKey, encrypt, encryptPublicKey, decrypt } from './crypto';

export { decrypt };

const URL_BASE = "https://tiplink.io";
// const URL_BASE = "http://localhost:3000";
const API_URL_BASE = `${URL_BASE}/api`;

const STEP = 100;

// TODO harmonize constants with main
const FAUCET_ID_LENGTH = 12;
type ArgT = string | number | boolean | string[] | number[];

export class TipLinkClient {
  apiKey: string;
  version: number;

  // Set from apikey
  publicKey?: string;
  id?: number;

  campaigns: CampaignActions;

  public constructor(apiKey: string, version=1) {
    this.apiKey = apiKey;
    this.version = version;
    this.campaigns = new CampaignActions({client: this});
  }

  public static async init(apiKey: string, version=1): Promise<TipLinkClient> {
    const client = new TipLinkClient(apiKey, version);

    const apiKeyRes = await client.fetch("api_key");
    client.id = apiKeyRes['account']['id'];
    client.publicKey = apiKeyRes['account']['public_key'];

    return client;
  }

  // TODO type return?
  public async fetch(endpoint: string, args: Record<string, ArgT> | null = null, body: Record<string, unknown> | Array<Record<string, unknown> > | null = null, verb="GET") {
    const url = new URL(endpoint, `${API_URL_BASE}/v${this.version}/`);

    if (args !== null) {
      Object.entries(args).forEach(([key, value]) => {
        url.searchParams.append(key, value as string);
      });
    }

    const params = {
      method: verb,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
    } as Record<string, unknown>;

    if (body !== null) {
      params.body = JSON.stringify(body);
    }

    try {
      const result = await fetch(url.toString(), params);
      return await result.json();
    } catch (err) {
      console.error(err);
      // TODO how should we handle errors
      throw err;
    }
  }
}

class TipLinkApi {
  client: TipLinkClient;
  public constructor(client: TipLinkClient) {
    this.client = client;
  }
}

interface CampaignCreateParams {
  name: string;
  description: string;
  imageUrl: string;
  active: boolean; // default true
}

interface CampaignActionsConstructor {
  client: TipLinkClient;
}

interface CampaignFindParams {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  active: boolean; // default true
}

interface CampaignResult {
  id: number;
  name: string;
  description: string;
  image_url: string;
  active: boolean;
  encryption_salt: string;
}

interface CampaignAllParams {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  active: boolean; // default true

  limit: number;
  offset: number;
  sorting: string;
}

interface CampaignEntry {
  public_key: string;
  encrypted_link: string;
  funding_txn: string;
}

interface AnalyticsSummary {
  event_type_counts: Record<string, number>[];
  total: number;
  faucets_info: Record<string, number>[];
  campaign_info: Record<string, number>[];
}

enum Rate {
  DAILY = 0,
  WEEKLY,
  MONTHLY,
  YEARLY,
  FOREVER,
  MILLISECOND
}

interface RateLimit {
  id: number;
  rate: Rate;
}

interface Faucet {
  id: number;
  url_slug: string;
  active: boolean;
  fingerprint: boolean;
  recaptcha: boolean;
}

class CampaignActions extends TipLinkApi {
  public constructor(params: CampaignActionsConstructor) {
    super(params.client);
  }

  public async create(params: CampaignCreateParams): Promise<Campaign> {
    const name = typeof(params) != "undefined" && typeof(params.name) != "undefined" ? params.name : "";
    const description = typeof(params) != "undefined" && typeof(params.description) != "undefined" ? params.description : "";
    const imageUrl = typeof(params) != "undefined" && typeof(params.imageUrl) != "undefined" ? params.imageUrl : "";
    const active = typeof(params) != "undefined" && typeof(params.active) != "undefined" ? params.active : true;

    const salt = generateRandomSalt();

    const ck = await generateKey();

    const campaignData = {
      name: name,
      description: description,
      encryption_salt: salt,
      image_url: imageUrl,
      active: active,
    };

    const res = await this.client.fetch("campaigns", null, campaignData, "POST");

    const campaign = new Campaign({client: this.client, id: res['id'], name: res['name'], description: res['description'], imageUrl: res['image_url'], active: res['active'],});

    if (typeof(this.client.publicKey) == "undefined") {
      // TODO should we handle this differently
      throw "Unable to do server handshake with encryption key";
    } else {
      const encryptedCampaignKey = await encryptPublicKey(
        ck,
        this.client.publicKey,
      );

      const keyData = {
        campaign_id: campaign.id,
        account_id: this.client.id,
        is_owner: true,
        encrypted_campaign_key: encryptedCampaignKey,
      };

      await this.client.fetch(`campaigns/${campaign.id}/campaign_account_joins`, null, keyData, "POST");

      if(salt !== res['encryption_salt']) {
        console.error("encryption salt mismatch");
      }

      campaign.encryptionKey = ck;
    }

    campaign.encryptionSalt = res['encryption_salt'];
    return campaign;
  }

  public async find(params: CampaignFindParams): Promise<Campaign> {
    const findParams = {
      ...params,
      limit: 1,
      sorting: "-created_at",
    }

    const res = (await this.client.fetch("campaigns", findParams, null, "GET") as CampaignResult[])[0];

    const campaign = new Campaign({client: this.client, id: res['id'], name: res['name'], description: res['description'], imageUrl: res['image_url'], active: res['active'],});

    campaign.encryptionSalt = res['encryption_salt'];

    console.warn("unable to acquire decryption key");
    // const encryptedKeyRes = await this.client.fetch(`campaigns/${campaign.id}/campaign_account_joins`);
    // // TODO figure out how api keys will do key exchange / sharing to get privateKey
    // const decryptedCampaignKey = await decryptPrivateKey(
      // encryptedKeyRes.encrypted_campaign_key,
      // privateKey
    // );
    // campaign.encryptionKey = decryptedCampaignKey;

    return campaign;
  }

  public async all(params: CampaignAllParams): Promise<Campaign[]> {
    const filterParams = {
      ...params,
    }

    const campaignResults = (await this.client.fetch("campaigns", filterParams, null, "GET") as CampaignResult[]);

    const campaigns = campaignResults.map((res) => {
      const campaign = new Campaign({client: this.client, id: res['id'], name: res['name'], description: res['description'], imageUrl: res['image_url'], active: res['active'],});
      campaign.encryptionSalt = res['encryption_salt'];
      console.warn("unable to acquire decryption key");

    // const encryptedKeyRes = await this.client.fetch(`campaigns/${campaign.id}/campaign_account_joins`);
    // // TODO figure out how api keys will do key exchange / sharing to get privateKey
    // const decryptedCampaignKey = await decryptPrivateKey(
      // encryptedKeyRes.encrypted_campaign_key,
      // privateKey
    // );
    // campaign.encryptionKey = decryptedCampaignKey;

      return campaign;
    });


    return campaigns;
  }
}

interface GetEntriesParams {
  id: number | number[];

  // TODO harmonize pagination stuff and implement a pagination interface
  limit: number;
  offset: number;
  sorting: string | string[];
}

interface CampaignConstructorParams {
  client: TipLinkClient;
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  active: boolean;

}

export class Campaign extends TipLinkApi {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  active: boolean;

  encryptionKey?: string;
  encryptionSalt?: string;

  dispensers: DispenserActions;

  public constructor(
    params: CampaignConstructorParams
    // client: TipLinkClient, id: number, name: string, description: string, imageUrl: string, active: boolean = true
  ) {
    super(params.client);
    this.id = params.id;
    this.name = params.name;
    this.description = params.description;
    this.imageUrl = params.imageUrl;
    this.active = params.active;
    this.dispensers = new DispenserActions({client: this.client, campaign: this});
  }

  public async addEntries(tiplinks: TipLink[]): Promise<boolean> {
    const tiplinkToCampaignEntry = async (tiplink: TipLink) => {
      if(!this.encryptionKey || !this.encryptionSalt) {
        throw "No Encryption Key Set";
      }

      const encryptedLink = await encrypt(tiplink.url.toString(), this.encryptionKey, this.encryptionSalt);
      const publicKey = tiplink.keypair.publicKey.toString();

      const result = {
        public_key: publicKey,
        encrypted_link: encryptedLink,
        funding_txn: "funded", // TODO should we count it as funded when using api?
      };

      return result;
    };

    while (tiplinks.length) {
      const entries = await Promise.all(
        tiplinks.splice(-1 * STEP).map(tiplinkToCampaignEntry)
      );
      await this.client.fetch(`campaigns/${this.id}/campaign_entries`, null, entries, "POST");


      const analytics = entries.map((entry: CampaignEntry) => {
        return {
          event: "CREATED",
          public_key: entry.public_key,
        };
      })
      await this.client.fetch("analytics", null, analytics, "POST");
    }
    return true;
  }

  public async getEntries(params: GetEntriesParams): Promise<TipLink[] | null> {
    const entryToTipLink = async (entry: CampaignEntry): Promise<TipLink | null> => {
      if(typeof(this.encryptionKey) == "undefined" || typeof(this.encryptionSalt) == "undefined") {
        console.warn("No Decryption Key: Unable to decrypt entries");
        return null;
      }
      let link = "";
      if (entry.encrypted_link !== null) {
        link = await decrypt(
          entry.encrypted_link,
          this.encryptionKey,
          this.encryptionSalt,
        );
        return TipLink.fromLink(link);
      }
      return null;
    };

    const resEntries = await this.client.fetch(`campaigns/${this.id}/campaign_entries`, params as unknown as Record<string, ArgT>);

    let entries: TipLink[] = [];
    while (resEntries.length) {
      const entry = await Promise.all(resEntries.splice(-1 * STEP).map(entryToTipLink));
      entries = entries.concat(entry);
    }
    // TODO include analytics? and id give whole entry object?
    return entries;
  }

  public async getAnalytics(): Promise<AnalyticsSummary> {
    // TODO clean up response here and type
    const analyticsRes = await this.client.fetch(`campaigns/${this.id}/analytics_summary`);
    return analyticsRes;
  }
}

interface CreateDispenserParams {
  useCaptcha: boolean; // default true
  useFingerprint: boolean; // default true
  unlimitedClaims: boolean; // default false // WARNING: affects all faucets for now
  active?: boolean; // default true

  includedEntryIds?: number[];
  excludedEntryIds?: number[];
}

interface DispenserActionsConstructorParams {
  // TODO harmonize with and implements interface
  client: TipLinkClient;

  campaign: Campaign;
}

interface DispenserFindParams {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  active: boolean; // default true
}

interface DispenserAllParams {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  active: boolean; // default true

  limit: number;
  offset: number;
  sorting: string;
}

class DispenserActions extends TipLinkApi {
  campaign: Campaign;

  public constructor(params: DispenserActionsConstructorParams) {
    super(params.client);
    this.campaign = params.campaign;
  }

  public async create(params: CreateDispenserParams): Promise<Dispenser> {
    const useCaptcha = typeof(params) != "undefined" && typeof(params.useCaptcha) != "undefined" ? params.useCaptcha : true;
    const useFingerprint = typeof(params) != "undefined" && typeof(params.useFingerprint) != "undefined" ? params.useFingerprint : true;
    const unlimitedClaims = typeof(params) != "undefined" && typeof(params.unlimitedClaims) != "undefined" ? params.unlimitedClaims : true;
    const active = typeof(params) != "undefined" && typeof(params.active) != "undefined" && params.active !== null ? params.active : true;
    const includedEntryIds: number[] = typeof(params) != "undefined" && typeof(params.includedEntryIds) != "undefined" && params.includedEntryIds !== null ? params.includedEntryIds : [];
    const excludedEntryIds: number[] = typeof(params) != "undefined" && typeof(params.excludedEntryIds) != "undefined" && params.excludedEntryIds !== null ? params.excludedEntryIds : [];

    const rateLimits = await this.client.fetch(`campaigns/${this.campaign.id}/rate_limits`);

    await Promise.all(rateLimits.map(async (rateLimit: RateLimit) => {
      const deleteRateLimitRes = await this.client.fetch(`campaigns/${this.campaign.id}/rate_limits/${rateLimit['id']}`, null, null, "DELETE");
      return deleteRateLimitRes;
    }));

    if (!unlimitedClaims) {
      const rateLimitData = {
        rate: "FOREVER",
        rate_multiple: 1,
        claims: 1,
        // "rate_type": "user",
      };
      await this.client.fetch(`campaigns/${this.campaign.id}/rate_limits`, null, rateLimitData, "POST");
    }

    const faucetData = {
      active: active,
      name: "faucet",
      fingerprint: useFingerprint,
      recaptcha: useCaptcha,
    };
    const faucet = await this.client.fetch(`campaigns/${this.campaign.id}/faucet`, null, faucetData, "POST");

    const dispenser = new Dispenser({client: this.client, campaign: this.campaign, id: faucet['id'], urlSlug: faucet['url_slug'], useCaptcha: faucet['recaptcha'], useFingerprint: faucet['fingerprint'], unlimitedClaims: unlimitedClaims, active: faucet['active']});

    const faucetEntryData = {
      all: includedEntryIds.length === 0,
      included_campaign_entry_ids: includedEntryIds,
      excluded_campaign_entry_ids: excludedEntryIds,
    };

    await this.client.fetch(`campaigns/${this.campaign.id}/faucet/${faucet.id}/faucet_entries`, null, faucetEntryData, "POST");

    return dispenser;
  }

  public async find (params: DispenserFindParams): Promise<Dispenser> {
    const findParams = {
      ...params,
      limit: 1,
      sorting: "-created_at",
    }

    const faucet = (await this.client.fetch(`campaigns/${this.campaign.id}/faucet`, findParams, null, "GET") as Faucet[])[0];

    // TODO determine unlimited claims properly
    const dispenser = new Dispenser({client: this.client, campaign: this.campaign, id: faucet['id'], urlSlug: faucet['url_slug'], useCaptcha: faucet['recaptcha'], useFingerprint: faucet['fingerprint'], unlimitedClaims: false, active: faucet['active']});

    return dispenser;
  }

  public async all(params: DispenserAllParams): Promise<Dispenser[]> {
    const filterParams = {
      ...params,
    }

    const faucets = (await this.client.fetch(`campaigns/${this.campaign.id}/faucet`, filterParams, null, "GET") as Faucet[]);

    // TODO determine unlimited claims properly
    const dispensers = faucets.map((faucet: Faucet) => {
      const dispenser = new Dispenser({client: this.client, campaign: this.campaign, id: faucet['id'], urlSlug: faucet['url_slug'], useCaptcha: faucet['recaptcha'], useFingerprint: faucet['fingerprint'], unlimitedClaims: false, active: faucet['active']});
      return dispenser;
    });

    return dispensers;
  }
}

interface DispenserConstructorParams {
  client: TipLinkClient;
  campaign: Campaign;

  id: number;
  urlSlug: string;
  useCaptcha: boolean;
  useFingerprint: boolean;
  unlimitedClaims: boolean;
  active: boolean;
}

export class Dispenser extends TipLinkApi {
  campaign: Campaign;
  id: number;

  urlSlug: string;
  useCaptcha: boolean;
  useFingerprint: boolean;
  unlimitedClaims: boolean;
  active: boolean;

  url: URL;

  public constructor(params: DispenserConstructorParams) {
    super(params.client);
    this.campaign = params.campaign;
    this.urlSlug = params.urlSlug;
    this.useFingerprint = params.useFingerprint;
    this.unlimitedClaims = params.unlimitedClaims;
    this.useCaptcha = params.useCaptcha;
    this.active = params.active;
    this.id = params.id;
    this.url = this.getUrl();
  }

  private getUrl(): URL {
    if(typeof(this.campaign.encryptionKey) == "undefined") {
      throw "invalid dispenser no decryption key available";
    }
    const urlString = `${URL_BASE}/f/${this.campaign.id}-${this.urlSlug}#${this.campaign.encryptionKey}`;
    return new URL(urlString);
  }

  public async pause(): Promise<boolean> {
    const data = {
      active: false,
    };
    const faucet = await this.client.fetch(`campaigns/${this.campaign.id}/faucet/${this.id}`, null, data, "PUT");
    this.active = faucet.active;
    return true;
  }

  public async resume(): Promise<boolean> {
    const data = {
      active: true,
    };
    const faucet = await this.client.fetch(`campaigns/${this.campaign.id}/faucet/${this.id}`, null, data, "PUT");
    this.active = faucet.active;
    return true;
  }

  public async refresh(): Promise<URL> {
    const data = {
      url_slug: nanoid(FAUCET_ID_LENGTH),
    };
    const faucet = await this.client.fetch(`campaigns/${this.campaign.id}/faucet/${this.id}`, null, data, "PUT");
    this.urlSlug = faucet['url_slug'];
    this.url = this.getUrl();
    return this.url;
  }
  public async delete(): Promise<boolean> {
    await this.client.fetch(`campaigns/${this.campaign.id}/faucet/${this.id}`, null, null, "DELETE");
    return true;
  }
}


