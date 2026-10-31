/** @deprecated usar src/server/auth/session (o setSessionCookie/clearSessionCookie) */
export {
  signSessionToken as signAuthToken,
  verifySessionToken as verifyAuthToken,
} from "@/src/server/auth/session";
