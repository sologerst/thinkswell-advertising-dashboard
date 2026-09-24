import "server-only";
import bcrypt from "bcryptjs";

export const MIN_PASSWORD = 10;

export function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

let dummy: Promise<string> | undefined;

/**
 * Compare against a throwaway hash when the email doesn't exist, so response
 * timing doesn't reveal which emails have accounts.
 */
export function dummyHash() {
  dummy ??= bcrypt.hash("no-such-user-placeholder", 12);
  return dummy;
}
