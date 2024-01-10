import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import { Mint, getMint, getAssociatedTokenAddress } from '@solana/spl-token';
import { Program, BN } from '@coral-xyz/anchor';

import { IDL, TiplinkEscrow } from './anchor-generated/types/tiplink_escrow';
import {
  ESCROW_PROGRAM_ID,
  TREASURY_PUBLIC_KEY,
  PDA_SEED,
  DEPOSIT_URL_BASE,
} from './constants';
import { createGeneratedTipLink, getGeneratedTipLinkEmail } from '../enclave';

/**
 * Represents an on-chain escrow that can be withdrawn by the original depositor or a TipLink, e-mailed to a recipient.
 * The depositor does not see the TipLink, enabling multi-sig. (Otherwise, one signer could unilaterally withdraw the funds to themselves.)
 *
 * @remarks EscrowTipLinks currently only support SOL and SPL assets.
 */
export class EscrowTipLink {
  // Required
  toEmail: string;
  tiplinkPublicKey: PublicKey;
  amount: number;
  depositor: PublicKey;

  // Optional
  pda?: PublicKey; // Created on deposit
  mint?: Mint;

  get depositUrl(): URL {
    // Sanity check; error checking occurs in the enclave and on-chain program
    if (!this.pda) {
      throw new Error(
        'Attempted to get depositUrl from a non-deposited escrow.'
      );
    }

    const url = new URL(DEPOSIT_URL_BASE);
    url.searchParams.append('pda', this.pda.toString());

    return url;
  }

  private constructor(
    toEmail: string,
    tiplink: PublicKey,
    amount: number,
    depositor: PublicKey,
    pda?: PublicKey,
    mint?: Mint
  ) {
    this.toEmail = toEmail;
    this.tiplinkPublicKey = tiplink;
    this.amount = amount;
    this.depositor = depositor;
    this.pda = pda;
    this.mint = mint;
  }

  /**
   * Creates an EscrowTipLink instance to be deposited.
   */
  static async create(
    amount: number,
    toEmail: string,
    depositor: PublicKey,
    mint?: Mint
  ): Promise<EscrowTipLink> {
    const tiplink = await createGeneratedTipLink(toEmail);
    return new EscrowTipLink(
      toEmail,
      tiplink,
      amount,
      depositor,
      undefined,
      mint
    );
  }

  /**
   * Creates an EscrowTipLink instance from a deposited, on-chain escrow.
   */
  static async get(
    connection: Connection,
    pda: PublicKey
  ): Promise<EscrowTipLink | undefined> {
    const escrowProgram = new Program(
      IDL,
      ESCROW_PROGRAM_ID,
      { connection } // Provider interface only requires a connection, not a wallet
    );

    let pdaAccount;
    let mint: Mint | undefined;
    // TODO: Implement better method of deciphering between lamport and SPL PDAs
    try {
      // First see if it's a lamport escrow
      pdaAccount = await escrowProgram.account.escrowLamports.fetch(pda);
    } catch {
      try {
        // If not, see if it's a SPL escrow
        pdaAccount = await escrowProgram.account.escrowSpl.fetch(pda);
        const mintPublicKey = pdaAccount.mint as PublicKey;
        mint = await getMint(connection, mintPublicKey);
      } catch {
        // No escrow exists for this PDA
        // TODO: Provide info on whether it was withdrawn or never existed
        return undefined;
      }
    }

    const tiplinkPublicKey = pdaAccount.tiplink;
    const email = await getGeneratedTipLinkEmail(tiplinkPublicKey);

    return new EscrowTipLink(
      email,
      tiplinkPublicKey,
      pdaAccount.amount.toNumber(),
      pdaAccount.depositor,
      pda,
      mint
    );
  }

  private async depositLamportTx(
    tiplinkEscrowProgram: Program<TiplinkEscrow>,
    escrowId: PublicKey,
    pda: PublicKey
  ): Promise<Transaction> {
    const tx = await tiplinkEscrowProgram.methods
      .initializeLamport(new BN(this.amount.toString()), escrowId)
      .accounts({
        depositor: this.depositor,
        pda,
        treasury: TREASURY_PUBLIC_KEY, // TODO: Switch to mainnet address
        tiplink: this.tiplinkPublicKey,
      })
      .transaction();

    return tx;
  }

  private async depositSplTx(
    tiplinkEscrowProgram: Program<TiplinkEscrow>,
    escrowId: PublicKey,
    pda: PublicKey
  ): Promise<Transaction> {
    // Sanity check; error checking occurs in the enclave and on-chain program
    if (!this.mint) {
      throw new Error('Attempted to deposit SPL without mint set');
    }

    const pdaAta = await getAssociatedTokenAddress(
      this.mint.address,
      pda,
      true
    );
    // TODO: Support non-ATA for depositor
    const depositorAta = await getAssociatedTokenAddress(
      this.mint.address,
      this.depositor
    );

    const tx = await tiplinkEscrowProgram.methods
      .initializeSpl(new BN(this.amount.toString()), escrowId)
      .accounts({
        depositor: this.depositor,
        depositorTa: depositorAta,
        pda,
        pdaAta,
        tiplink: this.tiplinkPublicKey,
        treasury: TREASURY_PUBLIC_KEY, // TODO: Switch to mainnet address
        mint: this.mint.address,
      })
      .transaction();

    return tx;
  }

  async depositTx(connection: Connection): Promise<Transaction> {
    // Sanity check; error checking occurs in the enclave and on-chain program
    if (this.pda) {
      throw new Error('Escrow can only be deposited once');
    }

    const tiplinkEscrowProgram = new Program(
      IDL,
      ESCROW_PROGRAM_ID,
      { connection } // Provider interface only requires a connection, not a wallet
    );
    const escrowKeypair = Keypair.generate();
    const escrowId = escrowKeypair.publicKey;
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from(PDA_SEED), escrowId.toBuffer(), this.depositor.toBuffer()],
      tiplinkEscrowProgram.programId
    );

    const tx: Transaction = this.mint
      ? await this.depositSplTx(tiplinkEscrowProgram, escrowId, pda)
      : await this.depositLamportTx(tiplinkEscrowProgram, escrowId, pda);
    this.pda = pda;
    return tx;
  }

  private async withdrawLamportTx(
    tiplinkEscrowProgram: Program<TiplinkEscrow>,
    authority: PublicKey,
    dest: PublicKey
  ): Promise<Transaction> {
    const tx = await tiplinkEscrowProgram.methods
      .withdrawLamport()
      .accounts({
        authority,
        destination: dest,
        pda: this.pda,
      })
      .transaction();

    return tx;
  }

  private async withdrawSplTx(
    tiplinkEscrowProgram: Program<TiplinkEscrow>,
    authority: PublicKey,
    dest: PublicKey
  ): Promise<Transaction> {
    // Sanity check; error checking occurs in the enclave and on-chain program
    if (!this.pda) {
      throw new Error('Escrow has not been deposited.');
    }
    if (!this.mint) {
      throw new Error('Attempted to withdraw SPL without mint set');
    }

    // Recalculating to keep class state smaller
    const pdaAta = await getAssociatedTokenAddress(
      this.mint.address,
      this.pda,
      true
    );
    const destAta = await getAssociatedTokenAddress(this.mint.address, dest);

    const tx = await tiplinkEscrowProgram.methods
      .withdrawSpl()
      .accounts({
        authority,
        destination: dest,
        destinationAta: destAta,
        pda: this.pda,
        pdaAta,
        mint: this.mint.address,
      })
      .transaction();

    return tx;
  }

  async withdrawTx(
    connection: Connection,
    authority: PublicKey,
    dest: PublicKey
  ): Promise<Transaction> {
    // Sanity check; error checking occurs in the enclave and on-chain program
    if (!this.pda) {
      throw new Error('Escrow has not been deposited');
    }

    const tiplinkEscrowProgram = new Program(
      IDL,
      ESCROW_PROGRAM_ID,
      { connection } // Provider interface only requires a connection, not a wallet
    );

    if (this.mint) {
      return this.withdrawSplTx(tiplinkEscrowProgram, authority, dest);
    }
    return this.withdrawLamportTx(tiplinkEscrowProgram, authority, dest);
  }
}
