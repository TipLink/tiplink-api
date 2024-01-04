import { PublicKey } from '@solana/web3.js';

export const ENCLAVE_ENDPOINT = 'https://mailer.tiplink.io';

export const ESCROW_PROGRAM_ID = new PublicKey(
  '8TqqugH88U3fDEWeKHqBSxZKeqoRrXkdpy3ciX5GAruK'
);

export const TREASURY_PUBLIC_KEY_DEVNET = new PublicKey(
  'GUua2QL7guU2RjQJXyZt6ePHVWrhEW5PcRcuU1t2mmQF'
);

export const PDA_SEED = 'escrow';

export const DEPOSIT_URL_BASE =
  'https://tiplink-mailer.onrender.com/escrow-withdraw'; // TEMP
