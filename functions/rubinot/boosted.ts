import { corsHeaders, handleBoostedRequest } from "../../worker/src/boosted";

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

export function onRequestGet() {
  return handleBoostedRequest();
}
