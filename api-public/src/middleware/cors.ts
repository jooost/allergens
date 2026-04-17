import { HttpResponseInit } from "@azure/functions";

export function withCors(response: HttpResponseInit): HttpResponseInit {
  return {
    ...response,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Ocp-Apim-Subscription-Key",
      "Cache-Control": "public, max-age=300",
      ...(response.headers ?? {}),
    },
  };
}
