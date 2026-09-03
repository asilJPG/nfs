/**
 * Verifies the AES-CMAC implementation against the RFC 4493 vectors and checks
 * that a mocked tap round-trips through verifyTap. Run: npx tsx scripts/selftest-nfc.ts
 */
import { strict as assert } from "node:assert";
import {
  aesCmac,
  computeSunMac,
  deriveMetaKey,
  deriveTagMacKey,
  encryptPiccData,
  SunError,
  verifyTap,
} from "../lib/nfc/sun";

const key = Buffer.from("2b7e151628aed2a6abf7158809cf4f3c", "hex");
const message = Buffer.from(
  "6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411e5fbc1191a0a52eff69f2445df4f9b17ad2b417be66c3710",
  "hex",
);

const vectors: [number, string][] = [
  [0, "bb1d6929e95937287fa37d129b756746"],
  [16, "070a16b46b4d4144f79bdd9dd04a287c"],
  [40, "dfa66747de9ae63030ca32611497c827"],
  [64, "51f0bebf7e3b9d92fc49741779363cfe"],
];

for (const [length, expected] of vectors) {
  const actual = aesCmac(key, message.subarray(0, length)).toString("hex");
  assert.equal(actual, expected, `RFC 4493 vector for ${length}-byte message`);
}
console.log("AES-CMAC: 4/4 RFC 4493 vectors pass");

const master = Buffer.alloc(32, 0x5a);
const uid = "04A1B2C3D4E580";
const picc = { uid, counter: 42 };
const piccData = encryptPiccData(deriveMetaKey(master), picc);
const cmac = computeSunMac(deriveTagMacKey(master, uid), picc);

const decoded = verifyTap(master, piccData, cmac);
assert.deepEqual(decoded, picc, "tap round-trip");
console.log(`SUN round-trip: uid=${decoded.uid} counter=${decoded.counter}`);

assert.throws(
  () => verifyTap(master, piccData, cmac.replace(/^../, "00")),
  (error: unknown) => error instanceof SunError && error.code === "bad_cmac",
  "tampered CMAC must be rejected",
);

assert.throws(
  () => verifyTap(Buffer.alloc(32, 0x11), piccData, cmac),
  (error: unknown) => error instanceof SunError,
  "wrong master key must be rejected",
);
console.log("Forgery attempts rejected: 2/2");
console.log("\nOK");
