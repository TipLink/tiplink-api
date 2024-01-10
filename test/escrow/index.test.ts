// NOTE: Withdraw with emailed TipLink requires manual testing.

import {
  PublicKey,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

import { EscrowTipLink } from '../../src';
import { getDepositorKeypair, getConnection, getUsdcMint } from './helpers';

export const onchainTest =
  process.env.ONCHAIN_TESTS === 'true' ? test : test.skip;

let lamportEscrowTipLink: EscrowTipLink;
let lamportPda: PublicKey;

let splEscrowTipLink: EscrowTipLink;
let splPda: PublicKey;

beforeEach((done) => {
  if (process.env.ONCHAIN_TESTS === 'true') {
    // Sleep 3 seconds to avoid RPC throttling
    setTimeout(() => {
      done();
    }, 3000);
  } else {
    done();
  }
});

onchainTest('Creates lamport EscrowTipLink', async () => {
  const amount = 20000;
  const recipient = 'example@email.com';
  const depositor = (await getDepositorKeypair()).publicKey;

  lamportEscrowTipLink = await EscrowTipLink.create(
    amount,
    recipient,
    depositor
  );

  // Check
  expect(lamportEscrowTipLink.amount).toBe(amount);
  expect(lamportEscrowTipLink.toEmail).toBe(recipient);
  expect(lamportEscrowTipLink.depositor).toBe(depositor);
  expect(lamportEscrowTipLink.tiplinkPublicKey).toBeInstanceOf(PublicKey);
});

onchainTest(
  'Deposits lamport EscrowTipLink',
  async () => {
    const depositorKeypair = await getDepositorKeypair(0.1 * LAMPORTS_PER_SOL);
    const connection = getConnection();

    const tx = await lamportEscrowTipLink.depositTx(connection);
    await sendAndConfirmTransaction(connection, tx, [depositorKeypair]);

    // Check
    expect(lamportEscrowTipLink.pda).toBeDefined();
    lamportPda = lamportEscrowTipLink.pda as PublicKey;
    expect(lamportPda).toBeInstanceOf(PublicKey);
    expect(lamportEscrowTipLink.depositUrl).toBeInstanceOf(URL);
  },
  50000
); // Increase timeout for tx confirmation

onchainTest('Gets lamport EscrowTipLink', async () => {
  const connection = getConnection();

  if (!lamportPda) {
    throw new Error(
      `lamportPda must be defined to run unit test. Check 'Deposits lamport EscrowTipLink' test`
    );
  }

  const retrievedEscrowTipLink = await EscrowTipLink.get(
    connection,
    lamportPda
  );

  // Check
  expect(retrievedEscrowTipLink).toStrictEqual(lamportEscrowTipLink);
});

onchainTest(
  'Withdraws lamport EscrowTipLink with depositor',
  async () => {
    const connection = getConnection();
    const depositorKeypair = await getDepositorKeypair(0.1 * LAMPORTS_PER_SOL);

    const depositorStartBalance = await connection.getBalance(
      depositorKeypair.publicKey
    );

    const tx = await lamportEscrowTipLink.withdrawTx(
      connection,
      depositorKeypair.publicKey,
      depositorKeypair.publicKey
    );
    await sendAndConfirmTransaction(connection, tx, [depositorKeypair]);

    const depositorEndBalance = await connection.getBalance(
      depositorKeypair.publicKey
    );

    // Check
    expect(depositorEndBalance).toBeGreaterThan(depositorStartBalance); // Exact amounts are unit tested in the program repo
    const retrievedEscrowTipLink = await EscrowTipLink.get(
      connection,
      lamportPda
    );
    expect(retrievedEscrowTipLink).toBeUndefined();
  },
  50000
); // Increase timeout for tx confirmation

onchainTest('Creates SPL EscrowTipLink', async () => {
  const usdcMint = await getUsdcMint();

  const amount = 1;
  const recipient = 'example@email.com';
  const depositor = (await getDepositorKeypair()).publicKey;

  splEscrowTipLink = await EscrowTipLink.create(
    amount,
    recipient,
    depositor,
    usdcMint
  );

  // Check
  expect(splEscrowTipLink.mint).toBe(usdcMint);
  expect(splEscrowTipLink.amount).toBe(amount);
  expect(splEscrowTipLink.toEmail).toBe(recipient);
  expect(splEscrowTipLink.depositor).toBe(depositor);
  expect(splEscrowTipLink.tiplinkPublicKey).toBeInstanceOf(PublicKey);
});

onchainTest(
  'Deposits SPL EscrowTipLink',
  async () => {
    const connection = getConnection();
    const depositorKeypair = await getDepositorKeypair(
      0.1 * LAMPORTS_PER_SOL,
      splEscrowTipLink.amount
    );

    const tx = await splEscrowTipLink.depositTx(connection);
    await sendAndConfirmTransaction(connection, tx, [depositorKeypair]);

    // Check
    expect(splEscrowTipLink.pda).toBeDefined();
    splPda = splEscrowTipLink.pda as PublicKey;
    expect(splPda).toBeInstanceOf(PublicKey);
    expect(splEscrowTipLink.depositUrl).toBeInstanceOf(URL);
  },
  50000
); // Increase timeout for tx confirmation

onchainTest('Gets SPL EscrowTipLink', async () => {
  const connection = getConnection();

  if (!splPda) {
    throw new Error(
      `splPda must be defined to run unit test. Check 'Deposits SPL EscrowTipLink' test`
    );
  }

  const retrievedEscrowTipLink = await EscrowTipLink.get(connection, splPda);

  // Check
  expect(retrievedEscrowTipLink).toStrictEqual(splEscrowTipLink);
});

onchainTest(
  'Withdraws SPL EscrowTipLink with depositor',
  async () => {
    const connection = getConnection();
    const depositorKeypair = await getDepositorKeypair(0.1 * LAMPORTS_PER_SOL);
    const usdcMint = await getUsdcMint();

    const depositorAta = await getAssociatedTokenAddress(
      usdcMint.address,
      depositorKeypair.publicKey
    );
    const depositorAtaStartBalance = await connection.getTokenAccountBalance(
      depositorAta
    );

    const tx = await splEscrowTipLink.withdrawTx(
      connection,
      depositorKeypair.publicKey,
      depositorKeypair.publicKey
    );
    await sendAndConfirmTransaction(connection, tx, [depositorKeypair]);

    const depositorAtaEndBalance = await connection.getTokenAccountBalance(
      depositorAta
    );

    // Check
    expect(parseInt(depositorAtaEndBalance.value.amount)).toBeGreaterThan(
      parseInt(depositorAtaStartBalance.value.amount)
    ); // Exact amounts are unit tested in the program repo
    const retrievedEscrowTipLink = await EscrowTipLink.get(connection, splPda);
    expect(retrievedEscrowTipLink).toBeUndefined();
  },
  50000
); // Increase timeout for tx confirmation
