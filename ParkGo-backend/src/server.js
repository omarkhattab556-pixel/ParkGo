import { createServer } from "node:http";
import { config } from "./lib/config.js";
import { loginAction } from "./action/authAction.js";

import {
  cancelReservationAction,
  createReservationAction,
  listMessagesAction,
  listParkingsAction,
  listReservationsAction,
  listSubscribersAction,
  registerSubscriberAction,
  reportSummaryAction,
  verifyPickupAction,
} from "./action/dashboardAction.js";

const readJsonBody = async (request) => {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};

  const rawBody = Buffer.concat(chunks).toString("utf8");

  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
};

const getCorsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin || config.clientOrigin || "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  Vary: "Origin",
});

const sendJson = (response, statusCode, payload, origin) => {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...getCorsHeaders(origin),
  });
  response.end(JSON.stringify(payload));
};

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "OPTIONS") {
    response.writeHead(204, getCorsHeaders(origin));
    response.end();
    return;
  }

  try {
    if (request.method === "GET" && requestUrl.pathname === "/api/health") {
      sendJson(
        response,
        200,
        {
          success: true,
          message: "ParkGo backend is running.",
        },
        origin
      );
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/auth/login") {
      const body = await readJsonBody(request);

      if (body === null) {
        sendJson(
          response,
          400,
          {
            success: false,
            message: "Request body must be valid JSON.",
          },
          origin
        );
        return;
      }

      const result = await loginAction(body);
      sendJson(response, result.status, result.body, origin);
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/api/subscribers") {
      const result = await listSubscribersAction();
      sendJson(response, result.status, result.body, origin);
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/subscribers") {
      const body = await readJsonBody(request);
      if (body === null) {
        sendJson(response, 400, { success: false, message: "Request body must be valid JSON." }, origin);
        return;
      }
      const result = await registerSubscriberAction(body);
      sendJson(response, result.status, result.body, origin);
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/api/parkings") {
      const result = await listParkingsAction();
      sendJson(response, result.status, result.body, origin);
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/api/reservations") {
      const subscriberId = requestUrl.searchParams.get("subscriberId");
      const result = await listReservationsAction(subscriberId);
      sendJson(response, result.status, result.body, origin);
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/reservations") {
      const body = await readJsonBody(request);
      if (body === null) {
        sendJson(response, 400, { success: false, message: "Request body must be valid JSON." }, origin);
        return;
      }
      const result = await createReservationAction(body);
      sendJson(response, result.status, result.body, origin);
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/reservations/cancel") {
      const body = await readJsonBody(request);
      if (body === null) {
        sendJson(response, 400, { success: false, message: "Request body must be valid JSON." }, origin);
        return;
      }
      const result = await cancelReservationAction(body);
      sendJson(response, result.status, result.body, origin);
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/parkings/verify-pickup") {
      const body = await readJsonBody(request);
      if (body === null) {
        sendJson(response, 400, { success: false, message: "Request body must be valid JSON." }, origin);
        return;
      }
      const result = await verifyPickupAction(body);
      sendJson(response, result.status, result.body, origin);
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/api/messages") {
      const userId = requestUrl.searchParams.get("userId");
      const result = await listMessagesAction(userId);
      sendJson(response, result.status, result.body, origin);
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/api/reports/summary") {
      const result = await reportSummaryAction();
      sendJson(response, result.status, result.body, origin);
      return;
    }

    sendJson(
      response,
      404,
      {
        success: false,
        message: "Route not found.",
      },
      origin
    );
  } catch (error) {
    sendJson(
      response,
      500,
      {
        success: false,
        message: "Internal server error.",
        error: error.message,
      },
      origin
    );
  }
});

server.listen(config.port, () => {
  console.log(`ParkGo backend listening on http://localhost:${config.port}`);
});
