// TODO figure better way to share with lib crypto on tiplink site
// TODO ts-ignore's for cryptoKey issues?
import type { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import { decodeUTF8, encodeUTF8 } from "tweetnacl-util";
export const DEFAULT_TIPLINK_KEYLENGTH = 12;

import { webcrypto } from "crypto";
const crypto = webcrypto;
import bs58 from "bs58";

/*
  Convert a string into an ArrayBuffer
  from https://developers.google.com/web/updates/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
*/
function stringToArrayBuffer(str: string) {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

// Crypto encrypting links in db and apikeys
const KEY_LENGTH_BYTES = 256;
const SALT_LENGTH_BYTES = 64;
const MODULUS_LENGTH = 4096;
const DIGEST_ALGO = "SHA-512";

const HASH_ALGO = "AES-GCM"; // Alternatives 'AES-CTR' 'AES-CBC' 'AES-GCM'
const HASH_ALGO_WTIH_PUBLIC_PRIVATE = "RSA-OAEP";

const EXPORT_HASH_ALGO = "A256GCM";
// const EXPORT_PUBLIC_PRIVATE_ALGO = "RSA-OAEP-512";

const EXPORT_FORMAT = "jwk";
const EXPORT_PUBLIC_FORMAT = "spki";
const EXPORT_PRIVATE_FORMAT = "pkcs8";

export const generateRandomSalt = () => {
  return Buffer.from(
    crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES))
  ).toString("hex");
};

export const generateKey = async () => {
  const key = await crypto.subtle.generateKey(
    {
      name: HASH_ALGO,
      length: KEY_LENGTH_BYTES,
    },
    true,
    ["encrypt", "decrypt"]
  );

  // @ts-ignore
  return exportKey(key);
};

const exportKey = async (key: CryptoKey) => {
  // @ts-ignore
  const exportableKey = await crypto.subtle.exportKey(EXPORT_FORMAT, key);
  // if (exportableKey.alg === EXPORT_HASH_ALGO) {
  if (exportableKey.k === undefined) {
    throw Error("Export Key Error");
  }
  return exportableKey.k;
  // }
};

const importKey = (key: string) => {
  const jwkKey = {
    alg: EXPORT_HASH_ALGO,
    k: key,
    ext: true,
    key_ops: ["encrypt", "decrypt"],
    kty: "oct",
  };
  return crypto.subtle.importKey(
    "jwk",
    jwkKey,
    {
      name: HASH_ALGO,
      length: KEY_LENGTH_BYTES,
    },
    true,
    ["encrypt", "decrypt"]
  );
};

export const encrypt = async (data: string, key: string, salt: string) => {
  const ec = new TextEncoder();
  const iv = Uint8Array.from(Buffer.from(salt, "hex"));
  const encKey = await importKey(key);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: HASH_ALGO,
      iv: iv,
    },
    encKey,
    ec.encode(data)
  );
  return Buffer.from(ciphertext).toString("hex");
};

export const decrypt = async (data: string, key: string, salt: string) => {
  const ciphertext = Uint8Array.from(Buffer.from(data, "hex"));
  const iv = Uint8Array.from(Buffer.from(salt, "hex"));
  const decKey = await importKey(key);
  const dec = new TextDecoder();
  const plaintext = await crypto.subtle.decrypt(
    {
      name: HASH_ALGO,
      iv: iv,
    },
    decKey,
    ciphertext
  );

  return dec.decode(plaintext);
};

export const generatePublicPrivateKey = async () => {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    {
      name: HASH_ALGO_WTIH_PUBLIC_PRIVATE,
      modulusLength: MODULUS_LENGTH,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: DIGEST_ALGO,
    },
    true,
    ["encrypt", "decrypt"]
  );

  return {
    // @ts-ignore
    publicKey: await exportPublicKey(publicKey),
    // @ts-ignore
    privateKey: await exportPrivateKey(privateKey),
  };
};

const exportPublicKey = async (publicKey: CryptoKey) => {
  // @ts-ignore
  const exportableKey = await crypto.subtle.exportKey(
    EXPORT_PUBLIC_FORMAT,
    publicKey
  );
  // TODO type check this?
  return btoa(
    // @ts-ignore
    String.fromCharCode.apply(null, new Uint8Array(exportableKey))
  );
  // return Buffer.from(exportableKey).toString('hex');
};

const importPublicKey = async (publicKey: string) => {
  // const arrBuf = Uint8Array.from(Buffer.from(publicKey, 'hex'));
  const arrBuf = stringToArrayBuffer(atob(publicKey));

  return crypto.subtle.importKey(
    EXPORT_PUBLIC_FORMAT,
    arrBuf,
    {
      name: HASH_ALGO_WTIH_PUBLIC_PRIVATE,
      // modulusLength: MODULUS_LENGTH,
      // publicExponent: new Uint8Array([1, 0, 1]),
      hash: DIGEST_ALGO,
    },
    true,
    ["encrypt"]
  );
};

const exportPrivateKey = async (privateKey: CryptoKey) => {
  // @ts-ignore
  const exportableKey = await crypto.subtle.exportKey(
    EXPORT_PRIVATE_FORMAT,
    privateKey
  );
  // TODO type check this?
  return btoa(
    // @ts-ignore
    String.fromCharCode.apply(null, new Uint8Array(exportableKey))
  );
  // return Buffer.from(exportableKey).toString('hex');
};

const importPrivateKey = async (privateKey: string) => {
  const arrBuf = stringToArrayBuffer(atob(privateKey));

  return crypto.subtle.importKey(
    EXPORT_PRIVATE_FORMAT,
    arrBuf,
    {
      name: HASH_ALGO_WTIH_PUBLIC_PRIVATE,
      // modulusLength: MODULUS_LENGTH,
      // publicExponent: new Uint8Array([1, 0, 1]),
      hash: DIGEST_ALGO,
    },
    true,
    ["decrypt"]
  );
};

export const encryptPublicKey = async (data: string, publicKey: string) => {
  const ec = new TextEncoder();
  const encKey = await importPublicKey(publicKey);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: HASH_ALGO_WTIH_PUBLIC_PRIVATE,
    },
    encKey,
    ec.encode(data)
  );
  return Buffer.from(ciphertext).toString("hex");
};

export const decryptPrivateKey = async (data: string, privateKey: string) => {
  const ciphertext = Uint8Array.from(Buffer.from(data, "hex"));

  const decKey = await importPrivateKey(privateKey);
  const dec = new TextDecoder();
  const plaintext = await crypto.subtle.decrypt(
    {
      name: HASH_ALGO_WTIH_PUBLIC_PRIVATE,
      // iv: iv,
    },
    decKey,
    ciphertext
  );

  return dec.decode(plaintext);
};

export const generateNonce = async () => {
  return Buffer.from(nacl.randomBytes(24)).toString("hex");
};

export const encryptMessage = async (
  keypair: Keypair,
  nonce: string,
  message: string
) => {
  const nonceArray = Uint8Array.from(Buffer.from(nonce, "hex"));
  return nacl.secretbox(
    decodeUTF8(message),
    nonceArray,
    keypair.secretKey.slice(32)
  );
};

export const decryptMessage = async (
  keypair: Keypair,
  nonce: string,
  encryptedMessage: string
) => {
  const nonceArray = Uint8Array.from(Buffer.from(nonce, "hex"));
  const encryptedMessageArray = Uint8Array.from(
    Buffer.from(encryptedMessage, "hex")
  );
  // const encryptedMessageArray = stringToArrayBuffer(window.atob(encryptedMessage));
  const res = nacl.secretbox.open(
    encryptedMessageArray,
    nonceArray,
    keypair.secretKey.slice(32)
  );
  if (res === null) {
    return "";
  } else {
    return encodeUTF8(res);
  }
};

// encrypted using symmetric key encryption generated from a Diffie-Hellman key exchange
// https://en.wikipedia.org/wiki/Diffie%E2%80%93Hellman_key_exchange'
// export const encryptDataUsingDH = (
//   dataToEncrypt: { [key: string]: any },
//   recipientEncryptionPubKey: Uint8Array | string // bs58 encoded string or nacl box public key (not solana keypair)
// ) => {
//   // nacl box keypair (not solana wallet keypair)
//   const keypair = nacl.box.keyPair();
//   const nonce = nacl.randomBytes(24);
//   const dataBuffer = Buffer.from(JSON.stringify(dataToEncrypt));
//   const recipientPubKey =
//     typeof recipientEncryptionPubKey === "string"
//       ? bs58.decode(recipientEncryptionPubKey)
//       : recipientEncryptionPubKey;
//   const encryptedData = nacl.box(
//     dataBuffer,
//     nonce,
//     recipientPubKey,
//     keypair.secretKey
//   );
//   return {
//     nonceUint8Arr: nonce,
//     nonceBs58: bs58.encode(nonce),
//     encryptedDataUint8Arr: encryptedData,
//     encryptedDataBs58: bs58.encode(encryptedData),
//     encryptionKeypairToHold: keypair,
//   };
// };

export const decryptDataUsingDH = (
  dataToDecrypt: Uint8Array | string, // string must be bs58 encoded
  nonce: Uint8Array | string, //  string must be bs58 encoded
  senderEncryptionPubKey: Uint8Array | string, //  string must be bs58 encoded
  encryptionKeypair: nacl.BoxKeyPair
) => {
  const encryptedData =
    typeof dataToDecrypt === "string"
      ? bs58.decode(dataToDecrypt)
      : dataToDecrypt;
  const encryptionNonce = typeof nonce == "string" ? bs58.decode(nonce) : nonce;
  const senderPubKey =
    typeof senderEncryptionPubKey === "string"
      ? bs58.decode(senderEncryptionPubKey)
      : senderEncryptionPubKey;
  const decryptedData = nacl.box.open(
    encryptedData,
    encryptionNonce,
    senderPubKey,
    encryptionKeypair.secretKey
  );
  if (!decryptedData) return;
  const decryptonDataJson = JSON.parse(
    Buffer.from(decryptedData).toString("utf8")
  );
  // json.parse returns "any" typed json so ok to silence eslint error
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return decryptonDataJson;
};

export { decodeUTF8, encodeUTF8 };
