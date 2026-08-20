const { classifyConversationIntent } = require("./conversationIntent");

const GREETING_REPLY =
  "Hi! I’m here to help with HMCTS Platform Operations issues, errors, deployments, access requests and related support questions. I’ll do my best to find an answer or help you raise a request. What can I help with?";
const OFF_TOPIC_REPLY =
  "I’m here to help with HMCTS Platform Operations work. Please send a platform issue, error, deployment, access request or support question, and I’ll do my best to help.";

async function orchestrateConversation({ question, pendingPlatform }) {
  if (pendingPlatform) return { action: "platform_answer" };
  let intent = "platform_related";
  try {
    intent = await classifyConversationIntent(question);
  } catch (error) {
    console.warn("Could not classify conversation intent", error);
  }
  if (intent === "greeting") return { action: "reply", text: GREETING_REPLY };
  if (intent === "off_topic") return { action: "reply", text: OFF_TOPIC_REPLY };
  return { action: "platform_related" };
}

module.exports.orchestrateConversation = orchestrateConversation;
