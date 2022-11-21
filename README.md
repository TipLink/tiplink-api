# TipLink SDK

[Full Documentation](https://docs.tiplink.io)


# What is Tiplink?

TipLink is a lightweight wallet designed to make transferring digital assets as easy as sending a link. Our non-custodial wallet allows you to have complete control of your assets by connecting your Gmail account or Solana wallet.

Someone with crypto can create a TipLink and send that link to anyone over any platform (text, discord, email, etc). The amazing thing is, the link is the wallet!

TipLink offers the benefits of decentralization and self-custody without worrying about seed phrases, arcane key management, apps, and browser extensions.

# Basic Installation instructions
```bash
npm install @tiplink/sdk
```
Import Instructions
```js
import { Tiplink } from '@tiplink/sdk';
```
Create a tiplink
```js
Tiplink.create().then(tiplink => {
  console.log("link: ", tiplink.url.toString());
  console.log("publicKey: ", tiplink.keypair.publicKey.toBase58());
  return tiplink;
});
```
```js
const tp = 'https://tiplink.io/i#TIPLINK_HASH';
Tiplink.fromLink(tp).then(tiplink => {
  console.log("converted publicKey: ", tiplink.keypair.publicKey.toBase58());
  return tiplink;
});
```
