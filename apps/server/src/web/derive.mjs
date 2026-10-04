// Turns an email + password into the login secret, exactly like the app does
// (packages/crypto derivePasswordSecrets). Served to the account-deletion web
// page so the password never leaves the browser; a test keeps the two in sync.
export function deriveAuthSecret(sodium, email, password) {
  const salt = sodium.crypto_generichash(sodium.crypto_pwhash_SALTBYTES, `realme:${email.trim().toLowerCase()}`, null);
  const master = sodium.crypto_pwhash(
    32,
    password,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
  return sodium.to_base64(sodium.crypto_kdf_derive_from_key(32, 1, 'realmekd', master));
}
