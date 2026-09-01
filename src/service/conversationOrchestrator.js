const { understandConversationTurn } = require("./conversationIntent");

const GREETING_REPLY =
  "Hi! I’m here to help with HMCTS Platform Operations queries. Which platform do you need support with?";
const OFF_TOPIC_REPLY =
  "I’m here to help with HMCTS Platform Operations work. Please send a platform issue, error, deployment, access request or support question, and I’ll do my best to help.";
const NEEDS_ISSUE_REPLY =
  "What issue or question can I help with? Please describe the problem, error or request you’re dealing with.";

function isPlatformSelection(question) {
  return /^(?:crime\s*\/\s*cpp|cloud\s*native\s*\/\s*other)$/i.test(
    question?.trim() ?? "",
  );
}

async function orchestrateConversation({
  question,
  pendingPlatform,
  greetingShown = false,
}) {
  if (pendingPlatform && isPlatformSelection(question)) {
    return { action: "platform_answer" };
  }
  let intent = "platform_related";
  let response = "";
  try {
    const turn = await understandConversationTurn({ question, greetingShown });
    intent = turn.intent;
    response = turn.response;
  } catch (error) {
    console.warn("Could not understand conversation turn", error);
  }
  if (pendingPlatform && intent === "platform_related") {
    return { action: "platform_answer" };
  }
  if (intent === "greeting" && !greetingShown) {
    return {
      action: "reply",
      text: response || GREETING_REPLY,
      promptPlatform: true,
    };
  }
  if (intent === "needs_issue") {
    return { action: "reply", text: response || NEEDS_ISSUE_REPLY };
  }
  if (intent === "off_topic") {
    return { action: "reply", text: response || OFF_TOPIC_REPLY };
  }
  return { action: "platform_related" };
}

module.exports.orchestrateConversation = orchestrateConversation;
