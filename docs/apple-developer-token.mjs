// Genera un developer token (JWT ES256) para Apple Music / MusicKit.
// Uso:
//   node docs/apple-developer-token.mjs AuthKey_XXXXXXXXXX.p8 TEAM_ID KEY_ID [días=180]
// Requiere Node 18+. No necesita dependencias.
import { readFileSync } from "node:fs";
import { createPrivateKey, sign } from "node:crypto";

const [, , keyFile, teamId, keyId, days = "180"] = process.argv;
if (!keyFile || !teamId || !keyId) {
  console.error("Uso: node apple-developer-token.mjs AuthKey_XXXX.p8 TEAM_ID KEY_ID [días]");
  process.exit(1);
}
const b64url = (b) => Buffer.from(b).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const exp = now + Math.min(+days, 180) * 86400; // Apple permite máx. 6 meses
const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
const payload = b64url(JSON.stringify({ iss: teamId, iat: now, exp }));
const key = createPrivateKey(readFileSync(keyFile));
const sig = sign("sha256", Buffer.from(`${header}.${payload}`), { key, dsaEncoding: "ieee-p1363" });
console.log(`${header}.${payload}.${b64url(sig)}`);
