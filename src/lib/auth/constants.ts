export const SESSION_COOKIE = "tw_session";

export type SessionPayload = {
  uid: string;
  /** users.session_version at sign-in; a mismatch means the session was revoked. */
  sv: number;
  role: "admin" | "client";
};
