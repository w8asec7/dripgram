import { createRemoteJWKSet, jwtVerify } from "jose";
import { ApiError } from "./core";
const jwks = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);
export interface Principal {
  uid: string;
  token: string;
  anonymous?: boolean;
}
export type VerifyToken = (
  authorization: string | undefined,
) => Promise<Principal>;
export function firebaseVerifier(
  project: string,
  keys: Parameters<typeof jwtVerify>[1] = jwks,
): VerifyToken {
  return async (authorization) => {
    const token = authorization?.match(/^Bearer (\S+)$/)?.[1];
    if (!token)
      throw new ApiError(
        401,
        "AUTH_REQUIRED",
        "Sign in before using this service.",
      );
    try {
      const { payload } = await jwtVerify(token, keys, {
        issuer: `https://securetoken.google.com/${project}`,
        audience: project,
        algorithms: ["RS256"],
      });
      if (!payload.sub || payload.sub.length > 128) throw new Error();
      return {
        uid: payload.sub,
        token,
        anonymous:
          (payload.firebase as { sign_in_provider?: string } | undefined)
            ?.sign_in_provider === "anonymous",
      };
    } catch {
      throw new ApiError(
        401,
        "AUTH_EXPIRED",
        "Your session expired or is invalid. Sign in again.",
      );
    }
  };
}
