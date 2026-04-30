import {
  Environment,
  SignedDataVerifier,
  VerificationException,
  VerificationStatus,
  type ResponseBodyV2DecodedPayload,
  type JWSTransactionDecodedPayload,
} from "@apple/app-store-server-library";

function describeVerifyError(e: unknown): string {
  if (e instanceof VerificationException) {
    const statusName = VerificationStatus[e.status] ?? `STATUS_${e.status}`;
    const cause = e.cause?.message ?? e.message ?? "";
    return cause ? `${statusName}: ${cause}` : statusName;
  }
  if (e instanceof Error) {
    return `${e.name}: ${e.message || "(no message)"}`;
  }
  return String(e);
}

const APPLE_BUNDLE_ID = "pro.neuroquestzen.app";
const APP_APPLE_ID = 6763640852;

/**
 * Apple Root CA — G3 (DER, base64-encoded).
 *
 * Source: https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
 * SHA-256 fingerprint: 6334:3ABF:B89A:6A03:EBB5:7E9B:3F5F:A7BE:7C4F:5C75:6F30:17B3:A8C4:88C3:653E:9179
 *   (matches Apple's published fingerprint).
 *
 * This is the trust anchor used to validate the x5c chain of every App Store
 * Server Notification V2 signedPayload. It is embedded as a string constant
 * rather than read from disk so the verifier survives esbuild bundling to
 * a single CJS file (build.ts emits dist/index.cjs).
 *
 * The companion file at src/lib/apple-roots/AppleRootCA-G3.cer is kept in the
 * repo only for human auditing — it is not loaded at runtime.
 */
const APPLE_ROOT_CA_G3_BASE64 =
  "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==";

let appleRootCerts: Buffer[] | null = null;

function loadAppleRootCerts(): Buffer[] {
  if (appleRootCerts) return appleRootCerts;
  appleRootCerts = [Buffer.from(APPLE_ROOT_CA_G3_BASE64, "base64")];
  return appleRootCerts;
}

let prodVerifier: SignedDataVerifier | null = null;
let sandboxVerifier: SignedDataVerifier | null = null;

function getProdVerifier(): SignedDataVerifier {
  if (!prodVerifier) {
    prodVerifier = new SignedDataVerifier(
      loadAppleRootCerts(),
      true,
      Environment.PRODUCTION,
      APPLE_BUNDLE_ID,
      APP_APPLE_ID,
    );
  }
  return prodVerifier;
}

function getSandboxVerifier(): SignedDataVerifier {
  if (!sandboxVerifier) {
    sandboxVerifier = new SignedDataVerifier(
      loadAppleRootCerts(),
      true,
      Environment.SANDBOX,
      APPLE_BUNDLE_ID,
    );
  }
  return sandboxVerifier;
}

export type VerifyResult =
  | { ok: true; decoded: ResponseBodyV2DecodedPayload; environment: "production" | "sandbox" }
  | { ok: false; reason: string };

/**
 * Verify and decode an Apple App Store Server Notification V2 signedPayload.
 *
 * Performs full JWS verification:
 *   1. Parses the JWS header's x5c chain (leaf -> intermediate -> root).
 *   2. Validates that chain against Apple Root CA G3 (bundled DER cert).
 *   3. Verifies the JWS signature with the leaf certificate's public key.
 *   4. Asserts bundleId, environment, and (production only) appAppleId match
 *      what we registered with App Store Connect.
 *   5. Returns the fully-decoded notification payload.
 *
 * Tries the production verifier first, then falls back to sandbox so a single
 * server can accept notifications from both Apple environments (sandbox is used
 * during App Review and TestFlight, production after release).
 *
 * Any failure -> { ok: false, reason }. Callers MUST reject with an HTTP error
 * before mutating entitlement state.
 */
export async function verifyAppleNotification(
  signedPayload: string,
): Promise<VerifyResult> {
  let prodErr: unknown;
  try {
    const decoded = await getProdVerifier().verifyAndDecodeNotification(signedPayload);
    return { ok: true, decoded, environment: "production" };
  } catch (e) {
    prodErr = e;
  }

  try {
    const decoded = await getSandboxVerifier().verifyAndDecodeNotification(signedPayload);
    return { ok: true, decoded, environment: "sandbox" };
  } catch (sandboxErr) {
    return {
      ok: false,
      reason: `prod=${describeVerifyError(prodErr)}; sandbox=${describeVerifyError(sandboxErr)}`,
    };
  }
}

export type VerifyTxResult =
  | { ok: true; tx: JWSTransactionDecodedPayload }
  | { ok: false; reason: string };

/**
 * Verify and decode a signedTransactionInfo JWS using the same Apple-rooted
 * chain as the outer notification. The `environment` argument should be the
 * environment that successfully verified the parent notification — this keeps
 * us from accepting a sandbox-signed inner payload nested inside a
 * production-signed outer envelope (or vice versa).
 */
export async function verifyAppleTransaction(
  signedTransactionInfo: string,
  environment: "production" | "sandbox",
): Promise<VerifyTxResult> {
  const verifier =
    environment === "production" ? getProdVerifier() : getSandboxVerifier();
  try {
    const tx = await verifier.verifyAndDecodeTransaction(signedTransactionInfo);
    return { ok: true, tx };
  } catch (e) {
    return { ok: false, reason: describeVerifyError(e) };
  }
}
