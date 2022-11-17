// import { createTipLink, linkToKeypair } from "../src";
// import { Keypair } from "@solana/web3.js"

import { Tiplink } from "../src";

test("returns valid TipLink", () => {
  return Tiplink.create().then((tipLink: Tiplink) => {
    expect(typeof tipLink.url.hash).toBe('string');
    expect(typeof tipLink.keypair.publicKey.toBase58()).toBe('string');
  });
})

test("matches website", () => {
  return Tiplink.fromLink('https://tiplink.io/i#5jC3aFcBJR4g4BQ5D').then((tipLink: Tiplink) => {
    expect(tipLink.url.hash).toBe('#5jC3aFcBJR4g4BQ5D');
    expect(tipLink.keypair.publicKey.toBase58()).toBe('6xcGWYuk9HMCPiEeu1AtHAZdEpFt97Qi6JCuKCVyph4');
  });
})


