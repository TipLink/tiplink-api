const m = require("../src/index");
const bs58 = require('bs58');
const createTipLink = m.createTipLink;
const linkToKeypair = m.linkToKeypair;

test("returns valid TipLink", () => {
	return createTipLink().then((tipLink: any) => {
		expect(typeof tipLink.link).toBe('string');
		expect(typeof tipLink.keypair.publicKey.toBase58()).toBe('string');
	});
})

test("matches website", () => {
	return linkToKeypair('https://tiplink.io/i#5jC3aFcBJR4g4BQ5D').then((kp: any) => {
		expect(kp.publicKey.toBase58()).toBe('6xcGWYuk9HMCPiEeu1AtHAZdEpFt97Qi6JCuKCVyph4');
	});
})


