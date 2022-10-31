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

export const createTipLink = async () => {
  if (!sodium) sodium = await SodiumPlus.auto();
  const b = await randBuf(DEFAULT_TIPLINK_KEYLENGTH);
  const keypair = await pwToKeypair(b);
  const link = new URL(TIPLINK_PATH, TIPLINK_ORIGIN);
  link.hash = b58encode(b);
  return {link: link.toString(), keypair: keypair};
};

export const linkToKeypair = async (link: string) => {
  const url = new URL(link);
  const slug = url.hash.slice(1);
  const pw = Buffer.from(b58decode(slug));
  return await pwToKeypair(pw);
}

// TODO should we put these methods on the TipLink type or just have a client
// just having a client is nice for API key issuance down the road.
export type TipLink = {
  url: URL,
  keypair: Keypair,
  fromURL: (url: string) => TipLink
  create: () => TipLink
}

export type TipLinkClient = {
  create: () => Promise<TipLink>,
  urlToTipLink: (url: string) => Promise<TipLink>
}


module.exports = {
    createTipLink: createTipLink,
    linkToKeypair: linkToKeypair
};
