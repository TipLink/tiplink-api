import { Keypair } from '@solana/web3.js';
import { SodiumPlus } from 'sodium-plus';
import { encode as b58encode, decode as b58decode } from "bs58";

const DEFAULT_TIPLINK_KEYLENGTH = 12;
const TIPLINK_ORIGIN = "https://tiplink.io";
const TIPLINK_PATH = "/i"

let sodium: SodiumPlus;

const kdf = async (fullLength: number, pwShort: Buffer, salt: Buffer) => {
  if (!sodium) sodium = await SodiumPlus.auto();
  const pwKey = await sodium.crypto_pwhash(
    fullLength,
    pwShort, salt,
    sodium.CRYPTO_PWHASH_OPSLIMIT_INTERACTIVE,
    sodium.CRYPTO_PWHASH_MEMLIMIT_INTERACTIVE
  );
  return pwKey.getBuffer();
};

const randBuf = async (l: number) => {
  if(!sodium) sodium = await SodiumPlus.auto();
  return sodium.randombytes_buf(l);
};

const kdfz = async (fullLength: number, pwShort: Buffer) => {
  if (!sodium) sodium = await SodiumPlus.auto();
  const salt = Buffer.alloc(sodium.CRYPTO_PWHASH_SALTBYTES);
  return await kdf(fullLength, pwShort, salt);
};

const pwToKeypair = async (pw: Buffer) => {
  if (!sodium) sodium = await SodiumPlus.auto();
  const seed = await kdfz(sodium.CRYPTO_SIGN_SEEDBYTES, pw);
  return(Keypair.fromSeed(seed));
}

export class TipLink {
  url: URL;
  keypair: Keypair;

  private constructor(url: URL, keypair: Keypair) {
    this.url = url;
    this.keypair = keypair;
  }

  public static async create(): Promise<TipLink> {
    if (!sodium) sodium = await SodiumPlus.auto();
    const b = await randBuf(DEFAULT_TIPLINK_KEYLENGTH);
    const keypair = await pwToKeypair(b);
    const link = new URL(TIPLINK_PATH, TIPLINK_ORIGIN);
    link.hash = b58encode(b);
    const tiplink = new TipLink(link, keypair);
    return tiplink;
  }

  public static async fromUrl(url: URL): Promise<TipLink> {
    const slug = url.hash.slice(1);
    const pw = Buffer.from(b58decode(slug));
    const keypair = await pwToKeypair(pw);
    const tiplink = new TipLink(url, keypair);
    return tiplink;
  }

  public static async fromLink(link: string): Promise<TipLink> {
    const url = new URL(link);
    return this.fromUrl(url);
  }

  // public getLink(): string {
    // return this.url.toString();
  // }
}

