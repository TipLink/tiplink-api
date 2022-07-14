import { createTipLink, linkToKeypair } from "../src";
import { Keypair } from "@solana/web3.js"

interface TipLink {
	link: string;
	keypair: Keypair;
}

test("returns valid TipLink", () => {
	return createTipLink().then((tipLink: TipLink) => {
		expect(typeof tipLink.link).toBe('string');
		expect(typeof tipLink.keypair.publicKey.toBase58()).toBe('string');
	});
})

test("matches website", () => {
	return linkToKeypair('https://tiplink.io/i#5jC3aFcBJR4g4BQ5D').then((kp: Keypair) => {
		expect(kp.publicKey.toBase58()).toBe('6xcGWYuk9HMCPiEeu1AtHAZdEpFt97Qi6JCuKCVyph4');
	});
})


