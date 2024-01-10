import 'dotenv/config';

import { mnemonicToSeedSync } from 'bip39';

import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import { getMint, Mint } from '@solana/spl-token';
import { getAssociatedTokenAddress } from '@solana/spl-token';

let connection: Connection;
export function getConnection() {
  if (connection) {
    return connection;
  }

  const rpcEndpoint = process.env.SOLANA_MAINNET_RPC as string;
  if (!rpcEndpoint) {
    throw new Error(
      `SOLANA_MAINNET_RPC env var must be set to run unit test. Set in .env file based on .env.example`
    );
  }

  // Finalized helps when needing to reliably check blockchain state changes in back to back unit tests
  connection = new Connection(rpcEndpoint, 'finalized');

  return connection;
}

let usdcMint: Mint;
export async function getUsdcMint() {
  if (usdcMint) {
    return usdcMint;
  }
  const conn = getConnection();

  const usdcMintPublicKey = new PublicKey(
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  );
  usdcMint = await getMint(conn, usdcMintPublicKey);

  return usdcMint;
}

function createKeypairFromSeedPhrase(seedPhrase: string): Keypair {
  const seedBuffer = mnemonicToSeedSync(seedPhrase);
  const seed = Buffer.alloc(32, seedBuffer);
  const keypair = Keypair.fromSeed(seed);
  return keypair;
}

export async function getDepositorKeypair(
  requiredLamports?: number,
  requiredUsdc?: number
): Promise<Keypair> {
  const conn = getConnection();

  const depositorSeedPhrase = process.env
    .TEST_ESCROW_DEPOSITOR_SEED_PHRASE as string;
  if (!depositorSeedPhrase) {
    throw new Error(
      `DEPOSITOR_SEED env var must be set to run unit test. Set in .env file based on .env.example`
    );
  }

  const depositorKeypair = createKeypairFromSeedPhrase(depositorSeedPhrase);

  if (requiredLamports) {
    const depositorBalance = await conn.getBalance(depositorKeypair.publicKey);
    if (depositorBalance < requiredLamports) {
      throw new Error(
        `Depositor lamport balance must be greater than ${requiredLamports} lamports to run unit test. Please send lamports to ${depositorKeypair.publicKey}`
      );
    }
  }

  if (requiredUsdc) {
    const mint = await getUsdcMint();
    const depositorAta = await getAssociatedTokenAddress(
      mint.address,
      depositorKeypair.publicKey
    );

    try {
      const depositorAtaBalance = await conn.getTokenAccountBalance(
        depositorAta
      );
      if (parseInt(depositorAtaBalance.value.amount) < requiredUsdc) {
        throw new Error();
      }
    } catch {
      throw new Error(
        `Depositor USDC balance must be greater than ${requiredUsdc} (decimals) to run unit test. Please send USDC to ${depositorKeypair.publicKey}`
      );
    }
  }

  return depositorKeypair;
}
