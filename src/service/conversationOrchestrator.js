const { understandConversationTurn } = require("./conversationIntent");

const GREETING_REPLY =
  "Hi! I’m here to help with HMCTS Platform Operations queries. Which platform do you need support with?";
const OFF_TOPIC_REPLY =
  "I’m here to help with HMCTS Platform Operations work. Please send a platform issue, error, deployment, access request or support question, and I’ll do my best to help.";

async function orchestrateConversation({
  question,
  pendingPlatform,
  greetingShown = false,
}) {
  if (pendingPlatform) return { action: "platform_answer" };
  let intent = "platform_related";
  let response = "";
  try {
    const turn = await understandConversationTurn({ question, greetingShown });
    intent = turn.intent;
    response = turn.response;
  } catch (error) {
    console.warn("Could not understand conversation turn", error);
  }
  if (intent === "greeting" && !greetingShown) {
    return {
      action: "reply",
      text: response || GREETING_REPLY,
      promptPlatform: true,
    };
  }
  if (intent === "off_topic") {
    return { action: "reply", text: response || OFF_TOPIC_REPLY };
  }
  return { action: "platform_related" };
}

module.exports.orchestrateConversation = orchestrateConversation;
