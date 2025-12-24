/**
 * POST /auth/login
 * Body: { email, password }
 * Returns: { token, staff: { staff_id, email, roles } }
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { parseJsonBody, getCorrelationId, json, toErrorResponse } from "../../lib/http.js";
import { Errors } from "../../lib/errors.js";
import { getStaffByEmail } from "../../lib/dynamodb.js";
import { verifyPassword } from "../../lib/password.js";
import { signAccessToken } from "../../lib/jwt.js";

const BodySchema = z.object({
  email: z.string().email().transform((s) => s.trim().toLowerCase()),
  password: z.string().min(1)
}).strict();

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const reqId = getCorrelationId(event);

  try {
    const body = parseJsonBody(event, BodySchema);

    const staff = await getStaffByEmail(body.email);
    if (!staff) throw Errors.unauthorized("Invalid credentials");
    if (!staff.enabled) throw Errors.unauthorized("Account disabled");

    const ok = await verifyPassword(body.password, staff.password_hash);
    if (!ok) throw Errors.unauthorized("Invalid credentials");

    const token = await signAccessToken({
      sub: staff.staff_id,
      email: staff.email,
      roles: staff.roles
    });

    return json(200, {
      token,
      staff: {
        staff_id: staff.staff_id,
        email: staff.email,
        roles: staff.roles
      }
    }, { "x-correlation-id": reqId });
  } catch (err) {
    return toErrorResponse(err, reqId);
  }
};
