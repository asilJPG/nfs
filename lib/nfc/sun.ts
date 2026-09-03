import { createCipheriv, createDecipheriv, createHmac, timingSafeEqual } from "node:crypto";

/**
 * NTAG 424 DNA "SUN" (Secure Unique NFC) verification — NXP AN12196.
 *
 * The tag writes two mirrors into the URL on every tap:
 *   picc_data — AES-CBC(K_meta) over [tag byte | UID(7) | tap counter(3) | padding]
 *   cmac      — 8 bytes of CMAC under a session key derived from K_mac(UID) + counter
 *
 * K_meta is one key for the whole fleet, because the UID is only readable after
 * decrypting, so it cannot itself be derived from the UID. K_mac is per tag, so
 * a leaked MAC key forges taps for one tag and no others. Both come from
 * NFC_MASTER_KEY and are never stored — only the UID is.
 */

const BLOCK = 16;
const ZERO_BLOCK = Buffer.alloc(BLOCK);

const META_KEY_LABEL = "stampy:sdm-meta:v1";
const MAC_KEY_LABEL = "stampy:sdm-mac:v1";

function xor(a: Uint8Array, b: Uint8Array): Buffer {
  const out = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}

function aesEcbEncrypt(key: Uint8Array, data: Uint8Array): Buffer {
  const cipher = createCipheriv("aes-128-ecb", key, null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

function shiftLeft(input: Uint8Array): Buffer {
  const out = Buffer.alloc(input.length);
  let carry = 0;
  for (let i = input.length - 1; i >= 0; i--) {
    out[i] = ((input[i] << 1) & 0xff) | carry;
    carry = input[i] & 0x80 ? 1 : 0;
  }
  return out;
}

/** RFC 4493 AES-128-CMAC. Node has no native CMAC. */
export function aesCmac(key: Uint8Array, message: Uint8Array): Buffer {
  const l = aesEcbEncrypt(key, ZERO_BLOCK);
  const k1 = shiftLeft(l);
  if (l[0] & 0x80) k1[BLOCK - 1] ^= 0x87;
  const k2 = shiftLeft(k1);
  if (k1[0] & 0x80) k2[BLOCK - 1] ^= 0x87;

  const blocks = Math.max(1, Math.ceil(message.length / BLOCK));
  const tailStart = (blocks - 1) * BLOCK;
  const tail = message.subarray(tailStart);
  const isComplete = message.length > 0 && message.length % BLOCK === 0;

  const last = isComplete
    ? xor(tail, k1)
    : xor(
        Buffer.concat([tail, Buffer.from([0x80]), Buffer.alloc(BLOCK - tail.length - 1)]),
        k2,
      );

  let x: Uint8Array = ZERO_BLOCK;
  for (let i = 0; i < blocks - 1; i++) {
    x = aesEcbEncrypt(key, xor(x, message.subarray(i * BLOCK, (i + 1) * BLOCK)));
  }
  return aesEcbEncrypt(key, xor(x, last));
}

export function deriveMetaKey(master: Uint8Array): Buffer {
  return createHmac("sha256", master).update(META_KEY_LABEL).digest().subarray(0, 16);
}

export function deriveTagMacKey(master: Uint8Array, uid: string): Buffer {
  return createHmac("sha256", master)
    .update(`${MAC_KEY_LABEL}:${uid.toUpperCase()}`)
    .digest()
    .subarray(0, 16);
}

export type PiccData = { uid: string; counter: number };

export class SunError extends Error {
  constructor(readonly code: "malformed" | "bad_picc" | "bad_cmac") {
    super(code);
  }
}

export function decryptPiccData(piccHex: string, metaKey: Uint8Array): PiccData {
  if (!/^[0-9a-fA-F]{32}$/.test(piccHex)) throw new SunError("malformed");

  const decipher = createDecipheriv("aes-128-cbc", metaKey, ZERO_BLOCK);
  decipher.setAutoPadding(false);
  const plain = Buffer.concat([
    decipher.update(Buffer.from(piccHex, "hex")),
    decipher.final(),
  ]);

  const tagByte = plain[0];
  const hasUid = (tagByte & 0x80) !== 0;
  const hasCounter = (tagByte & 0x40) !== 0;
  const uidLength = tagByte & 0x0f;
  // A tag we did not program, or a wrong key, lands here — the plaintext is noise.
  if (!hasUid || !hasCounter || uidLength !== 7) throw new SunError("bad_picc");

  return {
    uid: plain.subarray(1, 8).toString("hex").toUpperCase(),
    counter: plain[8] | (plain[9] << 8) | (plain[10] << 16),
  };
}

/** Session key for the read MAC: SV2 = 3Ch C3h 00h 01h 00h 80h || UID || counter. */
function sessionMacKey(macKey: Uint8Array, picc: PiccData): Buffer {
  const sv2 = Buffer.concat([
    Buffer.from([0x3c, 0xc3, 0x00, 0x01, 0x00, 0x80]),
    Buffer.from(picc.uid, "hex"),
    Buffer.from([picc.counter & 0xff, (picc.counter >> 8) & 0xff, (picc.counter >> 16) & 0xff]),
  ]);
  return aesCmac(macKey, sv2);
}

/** The tag sends every other byte of the CMAC, starting at index 1. */
function truncate(mac: Uint8Array): Buffer {
  const out = Buffer.alloc(8);
  for (let i = 0; i < 8; i++) out[i] = mac[i * 2 + 1];
  return out;
}

export function computeSunMac(macKey: Uint8Array, picc: PiccData, message: Uint8Array = Buffer.alloc(0)): string {
  return truncate(aesCmac(sessionMacKey(macKey, picc), message)).toString("hex").toUpperCase();
}

export function encryptPiccData(metaKey: Uint8Array, picc: PiccData): string {
  const plain = Buffer.concat([
    Buffer.from([0xc7]),
    Buffer.from(picc.uid, "hex"),
    Buffer.from([picc.counter & 0xff, (picc.counter >> 8) & 0xff, (picc.counter >> 16) & 0xff]),
    Buffer.alloc(5), // padding to one AES block
  ]);
  const cipher = createCipheriv("aes-128-cbc", metaKey, ZERO_BLOCK);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(plain), cipher.final()]).toString("hex").toUpperCase();
}

/**
 * Full check of one tap. Throws SunError; the caller maps that to a 400 page.
 * Replay protection lives in the database (counter must exceed the stored one),
 * because only the database knows what has already been seen.
 */
export function verifyTap(master: Uint8Array, piccHex: string, cmacHex: string): PiccData {
  if (!/^[0-9a-fA-F]{16}$/.test(cmacHex)) throw new SunError("malformed");

  const picc = decryptPiccData(piccHex, deriveMetaKey(master));
  const expected = computeSunMac(deriveTagMacKey(master, picc.uid), picc);

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(cmacHex.toUpperCase(), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new SunError("bad_cmac");

  return picc;
}
