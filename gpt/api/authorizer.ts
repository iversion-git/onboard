/**
 * HTTP API Lambda Request Authorizer (simple responses)
 * - Extract Bearer token
 * - Verify JWT signature/exp + iss/aud
 * - Optionally confirm staff exists + enabled
 * - Return context { staff_id, email, roles, stage }
 */
import type { APIGatewayRequestAuthorizerEventV2, APIGatewaySimpleAuthorizerResult } from "aws-lambda";
import { env } from "../lib/config.js";
import { extractBearerToken, verifyAccessToken } from "../lib/jwt.js";
import { getStaffById } from "../lib/dynamodb.js";

export const handler = async (event: APIGatewayRequestAuthorizerEventV2): Promise<APIGatewaySimpleAuthorizerResult> => {
  try {
    const token = extractBearerToken(event.headers);
    if (!token) return { isAuthorized: false };

    const claims = await verifyAccessToken(token);

    const staff = await getStaffById(claims.sub);
    if (!staff) return { isAuthorized: false };
    if (!staff.enabled) return { isAuthorized: false };

    return {
      isAuthorized: true,
      context: {
        staff_id: staff.staff_id,
        email: staff.email,
        roles: JSON.stringify(staff.roles),
        stage: env().STAGE
      }
    };
  } catch {
    return { isAuthorized: false };
  }
};
