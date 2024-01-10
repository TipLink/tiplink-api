import { PublicKey } from '@solana/web3.js';

export const ESCROW_PROGRAM_ID = new PublicKey(
  '8TqqugH88U3fDEWeKHqBSxZKeqoRrXkdpy3ciX5GAruK'
);

export const TREASURY_PUBLIC_KEY = new PublicKey(
  'BGZMcTjyTCbkRszC1CBpFpP9CbVh3Ah2ZhjzCsc9PsAr'
);

export const PDA_SEED = 'escrow';

export const DEPOSIT_URL_BASE =
  'https://tiplink-mailer.onrender.com/escrow-withdraw'; // TEMP
