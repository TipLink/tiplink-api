import { PublicKey } from '@solana/web3.js';

import { EscrowTipLink, TipLink } from '.';

const ENCLAVE_ENDPOINT = 'https://mailer.tiplink.io';

/**
 * Asynchronously calls secure enclave to create a TipLink, store it with an associated email, and return its public key.
 *
 * @param {string} email - The email address to be associated with the generated tiplink.
 * @returns {Promise<PublicKey>} A promise that resolves to the PublicKey of the generated tiplink.
 * @throws {Error} Throws an error if the HTTPS request fails with a non-ok status.
 */
export async function createGeneratedTipLink(
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
export async function getGeneratedTipLinkEmail(
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
 * Asynchronously emails a TipLink.
 *
 * @param {TipLink} tipLink - The TipLink object to be sent.
 * @param {string} toEmail - The email address of the recipient.
 * @param {string} [toName] - Optional name of the recipient for the email.
 * @param {string} [replyEmail] - Optional email address for the recipient to reply to.
 * @param {string} [replyName] - Optional name of the sender for the email.
 * @returns {Promise<void>} A promise that resolves when the email has been sent.
 * @throws {Error} Throws an error if the HTTP request fails with a non-ok status.
 */
export async function mail(
  tipLink: TipLink,
  toEmail: string,
  toName?: string,
  replyEmail?: string,
  replyName?: string
): Promise<void> {
  const url = `${ENCLAVE_ENDPOINT}/api/v1/email/send`;
  const body = {
    toEmail: toEmail,
    toName,
    replyEmail,
    replyName,
    tiplinkUrl: tipLink.url.toString(),
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
  console.log('TipLink sent!', res);
}

/**
 * Asynchronously emails a deposited Escrow TipLink to a pre-defined recipient.
 *
 * @param {EscrowTipLink} tiplinkPublicKey - The Escrow TipLink to be sent. Includes the toEmail and TipLink public key.
 * @param {string} [toName] - Optional name of the recipient for the email.
 * @param {string} replyEmail - Optional email address for the recipient to reply to.
 * @param {string} [replyName] - Optional name of the sender for the email.
 * @returns {Promise<void>} A promise that resolves when the email has been sent.
 * @throws {Error} Throws an error if the HTTP request fails with a non-ok status.
 */
export async function mailEscrow(
  escrowTipLink: EscrowTipLink,
  toName?: string,
  replyEmail?: string,
  replyName?: string
): Promise<void> {
  // Sanity check; error checking occurs in the enclave and on-chain program
  if (!escrowTipLink.pda) {
    throw new Error('Escrow has not been deposited');
  }

  const url = `${ENCLAVE_ENDPOINT}/api/v1/email/send/escrow`;
  const body = {
    toEmail: escrowTipLink.toEmail,
    toName,
    replyEmail,
    replyName,
    depositorUrl: escrowTipLink.depositUrl.toString(),
    tiplinkPublicKey: escrowTipLink.tiplinkPublicKey.toString(),
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
