import crypto from "node:crypto";

export type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PushPayload = {
  title: string;
  body: string;
  href?: string | null;
  tag?: string;
};

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

function encodeBase64Url(value: Buffer | string) {
  return (typeof value === "string" ? Buffer.from(value) : value).toString("base64url");
}

function hkdfExpand(prk: Buffer, info: Buffer, length: number) {
  const chunks: Buffer[] = [];
  let previous = Buffer.alloc(0);
  let counter = 1;
  let produced = 0;

  while (produced < length) {
    previous = crypto
      .createHmac("sha256", prk)
      .update(Buffer.concat([previous, info, Buffer.from([counter])]))
      .digest();
    chunks.push(previous);
    produced += previous.length;
    counter += 1;
  }

  return Buffer.concat(chunks).subarray(0, length);
}

function pushConfig() {
  const publicKey = String(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY ?? "").trim();
  const subject = String(process.env.VAPID_SUBJECT ?? "").trim();
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

export function getWebPushPublicKey() {
  return pushConfig()?.publicKey ?? null;
}

function vapidAuthorization(endpoint: string, config: NonNullable<ReturnType<typeof pushConfig>>) {
  const publicKey = decodeBase64Url(config.publicKey);
  const privateKey = decodeBase64Url(config.privateKey);
  if (publicKey.length !== 65 || publicKey[0] !== 4 || privateKey.length !== 32) {
    throw new Error("Chiavi VAPID non valide");
  }

  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: encodeBase64Url(publicKey.subarray(1, 33)),
    y: encodeBase64Url(publicKey.subarray(33, 65)),
    d: encodeBase64Url(privateKey),
  };
  const signingKey = crypto.createPrivateKey({ key: jwk, format: "jwk" });
  const origin = new URL(endpoint).origin;
  const header = encodeBase64Url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = encodeBase64Url(
    JSON.stringify({
      aud: origin,
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
      sub: config.subject,
    })
  );
  const unsigned = `${header}.${payload}`;
  const signature = crypto.sign("sha256", Buffer.from(unsigned), {
    key: signingKey,
    dsaEncoding: "ieee-p1363",
  });
  return `vapid t=${unsigned}.${encodeBase64Url(signature)}, k=${config.publicKey}`;
}

function encryptPayload(subscription: StoredPushSubscription, payload: string) {
  const clientPublicKey = decodeBase64Url(subscription.p256dh);
  const authSecret = decodeBase64Url(subscription.auth);
  if (clientPublicKey.length !== 65 || clientPublicKey[0] !== 4 || authSecret.length < 16) {
    throw new Error("Sottoscrizione push non valida");
  }

  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const serverPublicKey = ecdh.getPublicKey(undefined, "uncompressed");
  const sharedSecret = ecdh.computeSecret(clientPublicKey);

  const prkKey = crypto.createHmac("sha256", authSecret).update(sharedSecret).digest();
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    clientPublicKey,
    serverPublicKey,
  ]);
  const ikm = hkdfExpand(prkKey, keyInfo, 32);

  const salt = crypto.randomBytes(16);
  const prk = crypto.createHmac("sha256", salt).update(ikm).digest();
  const cek = hkdfExpand(prk, Buffer.from("Content-Encoding: aes128gcm\0", "utf8"), 16);
  const nonce = hkdfExpand(prk, Buffer.from("Content-Encoding: nonce\0", "utf8"), 12);

  const plaintext = Buffer.concat([Buffer.from(payload, "utf8"), Buffer.from([2])]);
  if (plaintext.length + 16 > 4096) throw new Error("Payload push troppo grande");

  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const encrypted = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  const header = Buffer.alloc(21 + serverPublicKey.length);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header[20] = serverPublicKey.length;
  serverPublicKey.copy(header, 21);

  return Buffer.concat([header, encrypted]);
}

export async function sendWebPush(
  subscription: StoredPushSubscription,
  payload: PushPayload
) {
  const config = pushConfig();
  if (!config) return { ok: false, status: 0, configured: false };

  const body = encryptPayload(subscription, JSON.stringify(payload));
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: vapidAuthorization(subscription.endpoint, config),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
    },
    body,
  });

  return { ok: response.ok, status: response.status, configured: true };
}
