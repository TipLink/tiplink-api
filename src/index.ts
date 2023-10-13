import { Keypair } from '@solana/web3.js';
import _sodium from "libsodium-wrappers-sumo";
import { encode as b58encode, decode as b58decode } from "bs58";

const DEFAULT_TIPLINK_KEYLENGTH = 12;
const TIPLINK_ORIGIN = "https://tiplink.io";
const TIPLINK_PATH = "/i"

const getSodium = async () => {
  await _sodium.ready;
  return _sodium;
}

const kdf = async (fullLength: number, pwShort: Uint8Array, salt: Uint8Array) => {
  const sodium = await getSodium();
  return sodium.crypto_pwhash(
    fullLength,
    pwShort,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_DEFAULT
  );
};

const randBuf = async (l: number) => {
  const sodium = await getSodium();
  return sodium.randombytes_buf(l);
};

const kdfz = async (fullLength: number, pwShort: Uint8Array) => {
  const sodium = await getSodium();
  const salt = new Uint8Array(sodium.crypto_pwhash_SALTBYTES);
  return await kdf(fullLength, pwShort, salt);
};

const pwToKeypair = async (pw: Uint8Array) => {
  const sodium = await getSodium();
  const seed = await kdfz(sodium.crypto_sign_SEEDBYTES, pw);
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
    await getSodium();
    const b = await randBuf(DEFAULT_TIPLINK_KEYLENGTH);
    const keypair = await pwToKeypair(b);
    const hash = b58encode(b);
    const urlString = `${TIPLINK_ORIGIN}${TIPLINK_PATH}#${hash}`;
    // can't assign hash as it causes an error in React Native
    const link = new URL(urlString)
    const tiplink = new TipLink(link, keypair);
    return tiplink;
  }

  public static async fromUrl(url: URL): Promise<TipLink> {
    const slug = url.hash.slice(1);
    const pw = Uint8Array.from(b58decode(slug));
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

import { TipLinkClient } from './client';
export { TipLinkClient };
