#!/usr/bin/env node
import crypto from "node:crypto";

const ecdh = crypto.createECDH("prime256v1");
ecdh.generateKeys();

const publicKey = ecdh.getPublicKey(undefined, "uncompressed").toString("base64url");
const privateKey = ecdh.getPrivateKey().toString("base64url");

console.log("\nCopia queste variabili in .env.local e su Vercel:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${privateKey}"`);
console.log('VAPID_SUBJECT="mailto:admin@example.com"\n');
