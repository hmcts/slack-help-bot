const crypto = require("crypto");
const { upsertAnalyticsEventInCosmos } = require("./cosmos");

function hashUserId(userId) {
  return crypto.createHash("sha256").update(String(userId)).digest("hex");
}

function eventId({ sessionId, step, stepValue }) {
  return crypto
    .createHash("sha256")
    .update(`${sessionId}|${step}|${stepValue || ""}`)
    .digest("hex");
}

async function recordAnalyticsEvent({
  sessionId,
  userId,
  step,
  stepValue,
  source = "conversational",
  area,
  ticketKey,
}) {
  if (!sessionId || !userId || !step) return;

  try {
    await upsertAnalyticsEventInCosmos({
      id: eventId({ sessionId, step, stepValue }),
      // Keep the persisted type stable so existing Cosmos and PostgreSQL data
      // remains queryable without a destructive migration.
      document_type: "help_request_funnel_event",
      session_id: sessionId,
      user_id_hash: hashUserId(userId),
      step,
      ...(stepValue && { step_value: stepValue }),
      source,
      ...(area && { area }),
      ...(ticketKey && { ticket_key: ticketKey }),
      occurred_at: new Date().toISOString(),
    });
  } catch (error) {
    // Analytics must never prevent a user from creating a ticket.
    console.error("Unable to record help request analytics event", {
      sessionId,
      step,
      error,
    });
  }
}

module.exports.recordAnalyticsEvent = recordAnalyticsEvent;
module.exports.hashUserId = hashUserId;
module.exports.eventId = eventId;
