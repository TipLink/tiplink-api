import { PublicKey } from '@solana/web3.js';

import { ENCLAVE_ENDPOINT } from './constants';

/**
 * Asynchronously calls secure enclave to create a TipLink, store it with an associated email, and return its public key.
 *
 * @param {string} email - The email address to be associated with the generated tiplink.
 * @returns {Promise<PublicKey>} A promise that resolves to the PublicKey of the generated tiplink.
 * @throws {Error} Throws an error if the HTTPS request fails with a non-ok status.
 */
export async function createGeneratedTiplink(
  email: string
): Promise<PublicKey> {
  const endpoint = `${ENCLAVE_ENDPOINT}/api/v1/generated-tiplinks/create`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    throw new Error(`HTTP error, status: ${res.status}`);
  }

  interface ResBody {
    data: {
      publicKey: string;
    };
  }
  const {
    data: { publicKey: publicKeyStr },
  }: ResBody = await res.json();

  return new PublicKey(publicKeyStr);
}

/**
 * Asynchronously calls secure enclave to retrieve the email associated with a TipLink public key.
 *
 * @param {PublicKey} publicKey - The public key of the TipLink for which to retrieve the associated email.
 * @returns {Promise<string>} A promise that resolves to the email address associated with the provided TipLink public key.
 * @throws {Error} Throws an error if the HTTPS request fails with a non-ok status.
 */
export async function getGeneratedTiplinkEmail(
  publicKey: PublicKey
): Promise<string> {
  const endpoint = `${ENCLAVE_ENDPOINT}/api/v1/generated-tiplinks/${publicKey.toString()}/email`;
  const res = await fetch(endpoint, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`HTTP error, status: ${res.status}`);
  }

  interface ResBody {
    data: {
      email: string;
    };
  }
  const {
    data: { email },
  }: ResBody = await res.json();

  return email;
}

/**
 * Asynchronously calls secure enclave to email recipient their Escrow TipLink.
 *
 * @param {string} toEmail - The email address of the recipient.
 * @param {PublicKey} tiplinkPublicKey - The public key of the TipLink to be sent.
 * @param {URL} depositUrl - The deposit URL which includes the PDA. TODO: Just send the PDA.
 *  * @param {string} [toName] - Optional name of the recipient for the email.
 * @param {string} replyEmail - Optional email address for the recipient to reply to. TODO: Remove this.
 * @param {string} [replyName] - Optional name of the sender for the email. TODO: Remove this.
 * @returns {Promise<void>} A promise that resolves when the email has been sent.
 * @throws {Error} Throws an error if the HTTP request fails with a non-ok status.
 */
export async function mailEscrowTipLink(
  toEmail: string,
  tiplinkPublicKey: PublicKey,
  depositUrl: URL,
  toName?: string,
  replyEmail?: string,
  replyName?: string
): Promise<void> {
  const url = `${ENCLAVE_ENDPOINT}/api/v1/email/send/escrow`;
  const body = {
    toEmail: toEmail,
    toName,
    replyEmail,
    replyName,
    depositorUrl: depositUrl.toString(),
    tiplinkPublicKey: tiplinkPublicKey.toString(),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`HTTP error, status: ${res.status}`);
  }
  console.log('Escrow TipLink sent!', res);
}
