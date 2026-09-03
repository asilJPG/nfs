/**
 * Produces a URL identical to what a real NTAG 424 would emit, so the whole tap
 * flow can be developed and tested before any hardware exists.
 *
 *   npm run mock-tag -- --uid 04A1B2C3D4E580 --counter 7
 *   npm run mock-tag -- --uid 04A1B2C3D4E580 --counter 7 --keys
 *
 * `--keys` prints the two AES keys to write into that chip when provisioning.
 */
import { computeSunMac, deriveMetaKey, deriveTagMacKey, encryptPiccData } from "../lib/nfc/sun";
import { arg, loadEnv, masterKey } from "./env";

loadEnv();

const uid = arg("uid").toUpperCase();
if (!/^[0-9A-F]{14}$/.test(uid)) {
  throw new Error("--uid must be the 7-byte NXP UID as 14 hex characters");
}

const counter = Number(arg("counter", "1"));
if (!Number.isInteger(counter) || counter < 1 || counter > 0xffffff) {
  throw new Error("--counter must be an integer between 1 and 16777215");
}

const base = arg("url", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const master = masterKey();

const picc = { uid, counter };
const piccData = encryptPiccData(deriveMetaKey(master), picc);
const cmac = computeSunMac(deriveTagMacKey(master, uid), picc);

console.log(`${base}/t?picc_data=${piccData}&cmac=${cmac}`);

if (process.argv.includes("--keys")) {
  console.log("\nProgram this chip with:");
  console.log(`  SDM Meta Read key (K_meta, same for every tag): ${deriveMetaKey(master).toString("hex").toUpperCase()}`);
  console.log(`  SDM File Read key (K_mac, unique to ${uid}):    ${deriveTagMacKey(master, uid).toString("hex").toUpperCase()}`);
  console.log("\nSee docs/nfc-provisioning.md for the mirror layout.");
}
