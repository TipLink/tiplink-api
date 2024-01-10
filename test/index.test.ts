import { TipLink } from '../src';

test('returns valid TipLink', () => {
  return TipLink.create().then((tipLink: TipLink) => {
    expect(typeof tipLink.url.hash).toBe('string');
    expect(typeof tipLink.keypair.publicKey.toBase58()).toBe('string');
  });
});

test('matches website', () => {
  return TipLink.fromLink('https://tiplink.io/i#5jC3aFcBJR4g4BQ5D').then(
    (tipLink: TipLink) => {
      expect(tipLink.url.hash).toBe('#5jC3aFcBJR4g4BQ5D');
      expect(tipLink.keypair.publicKey.toBase58()).toBe(
        '6xcGWYuk9HMCPiEeu1AtHAZdEpFt97Qi6JCuKCVyph4'
      );
    }
  );
});
