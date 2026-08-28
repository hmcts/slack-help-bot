const { answerConversation } = require("../service/conversationKnowledge");
const {
  orchestrateConversation,
} = require("../service/conversationOrchestrator");
const {
  knowledgeSearchPromptBlocks,
} = require("../messages/knowledgeSearchPrompt");
const {
  knowledgeSearchAnswerBlocks,
} = require("../messages/knowledgeSearchAnswer");
const {
  handleConversationalHelpReply,
  startConversationalHelpRequest,
} = require("./conversationalHelpRequest");
const {
  continueAfterDocumentation,
  handleClarificationReply,
  handleDocumentationFeedback,
  handleJiraFeedback,
} = require("./conversationEscalation");

const HISTORY_WINDOW_MS = 30 * 60 * 1000;
const MAX_HISTORY_TURNS = 8;
const CLOSED_THREAD_BLOCK_IDS = new Set([
  "knowledge_search_conversation_solved",
  "jira_search_conversation_solved",
  "help_request_conversation_cancelled",
  "help_request_conversation_complete",
]);
const PLATFORM_PROMPT_TEXT =
  "Hi! I’m here to help with HMCTS Platform Operations queries. Which platform do you need support with?";

function messageTimestampMs(message) {
  const seconds = Number.parseFloat(message.ts);
  return Number.isFinite(seconds) ? seconds * 1000 : 0;
}

function messageText(message) {
  if (typeof message.text === "string" && message.text.trim()) {
    return message.text.trim();
  }

  return (
    message.blocks?.find((block) => block.type === "section")?.text?.text ?? ""
  ).trim();
}

function isBotMessage(message) {
  return Boolean(message.bot_id || message.app_id);
}

function isGreetingMessage(text) {
  return /^(hi|hello|hey|hiya|good morning|good afternoon|good evening)[!.\s]*$/i.test(
    text?.trim() ?? "",
  );
}

function greetingAlreadyShown(messages) {
  return messages.some(
    (message) =>
      isBotMessage(message) &&
      (message.metadata?.event_type === "conversation_greeting" ||
        (/^(hello|hi|hey)[!.\s]/i.test(messageText(message)) &&
          message.blocks?.some(
            (block) =>
              block.block_id ===
              "knowledge_search_conversation_platform_prompt",
          ))),
  );
}

function isRecentMessage(message, now) {
  return now - messageTimestampMs(message) <= HISTORY_WINDOW_MS;
}

function recentMessages(messages, now = Date.now()) {
  return messages.filter((message) => isRecentMessage(message, now));
}

function isClosedConversation(messages) {
  return messages.some((message) =>
    message.blocks?.some((block) =>
      CLOSED_THREAD_BLOCK_IDS.has(block.block_id),
    ),
  );
}

function extractAreaFromHistory(messages) {
  for (const message of [...messages].reverse()) {
    const selectedArea = message.metadata?.event_payload?.area;
    if (
      message.metadata?.event_type === "platform_selected" &&
      (selectedArea === "crime" || selectedArea === "other")
    ) {
      return selectedArea;
    }
    const platformMarker = message.blocks?.find((block) =>
      block.block_id?.startsWith("knowledge_search_platform_selected_"),
    );
    if (platformMarker) {
      return platformMarker.block_id.endsWith("_crime") ? "crime" : "other";
    }
    const platformMarkerText = message.blocks
      ?.find((block) => {
        const text = block.elements?.map((element) => element.text).join(" ");
        return (
          block.block_id?.startsWith("knowledge_search_platform_selected_") ||
          /platform selected:/i.test(text ?? "")
        );
      })
      ?.elements?.map((element) => element.text)
      .join(" ");
    if (platformMarkerText) {
      if (/cloud native \/ other/i.test(platformMarkerText)) return "other";
      if (/crime \/ cpp/i.test(platformMarkerText)) return "crime";
    }
    const confirmationText = messageText(message);
    if (
      /platform selected:\s*\**cloud native \/ other/i.test(confirmationText)
    ) {
      return "other";
    }
    if (/platform selected:\s*\**crime \/ cpp/i.test(confirmationText)) {
      return "crime";
    }
    if (/i['’]ll search cloud native \/ other/i.test(confirmationText)) {
      return "other";
    }
    if (/i['’]ll search crime \/ cpp/i.test(confirmationText)) {
      return "crime";
    }
    const contextBlock = message.blocks?.find((block) =>
      block.block_id?.startsWith("knowledge_search_context_"),
    );
    if (contextBlock) {
      return contextBlock.block_id.endsWith("_crime") ? "crime" : "other";
    }
  }

  return undefined;
}

function conversationFromHistory(messages, currentMessageTs, now = Date.now()) {
  return messages
    .filter((message) => message.ts !== currentMessageTs)
    .filter((message) => isRecentMessage(message, now))
    .filter((message) => !message.subtype || message.subtype === "file_share")
    .filter(
      (message) =>
        !message.blocks?.some((block) =>
          block.block_id?.startsWith("help_request_conversation_"),
        ),
    )
    .map((message) => ({
      role: message.bot_id || message.app_id ? "assistant" : "user",
      content: messageText(message),
    }))
    .filter(({ content }) => content)
    .filter(
      ({ content }) =>
        content !== "Which platform do you need support with?" &&
        content !== "Searching documentation and generating an answer..." &&
        !content.startsWith("Hi! Ask me a Platform Operations question"),
    )
    .slice(-MAX_HISTORY_TURNS);
}

function pendingPlatformSelection(messages, currentMessageTs) {
  let promptIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (
      messages[index].blocks?.some(
        (block) =>
          block.block_id === "knowledge_search_conversation_platform_prompt",
      )
    ) {
      promptIndex = index;
      break;
    }
  }
  if (promptIndex < 0) return null;

  const resolvedByKnowledgeAnswer = messages
    .slice(promptIndex + 1)
    .some((item) =>
      item.blocks?.some((block) =>
        block.block_id?.startsWith("knowledge_search_context_"),
      ),
    );
  if (resolvedByKnowledgeAnswer) return null;

  const resolvedByPlatformSelection = messages
    .slice(promptIndex + 1)
    .some((item) => {
      const marker = item.blocks?.some((block) =>
        block.block_id?.startsWith("knowledge_search_platform_selected_"),
      );
      const text = messageText(item);
      return (
        marker ||
        /platform selected:\s*\**(?:cloud native \/ other|crime \/ cpp)/i.test(
          text,
        ) ||
        /i['’]ll search (?:cloud native \/ other|crime \/ cpp)/i.test(text)
      );
    });
  if (resolvedByPlatformSelection) return null;

  const alreadyAnswered = messages
    .slice(promptIndex + 1)
    .some(
      (item) =>
        item.ts !== currentMessageTs &&
        !item.bot_id &&
        !item.app_id &&
        item.text,
    );
  if (alreadyAnswered) return null;

  let firstPromptIndex = promptIndex;
  for (let index = promptIndex - 1; index >= 0; index -= 1) {
    if (
      messages[index].blocks?.some((block) =>
        block.block_id?.startsWith("knowledge_search_context_"),
      )
    ) {
      break;
    }
    if (
      messages[index].blocks?.some(
        (block) =>
          block.block_id === "knowledge_search_conversation_platform_prompt",
      )
    ) {
      firstPromptIndex = index;
    }
  }

  const questionMessage = [...messages.slice(0, firstPromptIndex)]
    .reverse()
    .find(
      (item) =>
        !item.bot_id &&
        !item.app_id &&
        item.text?.trim() &&
        !isGreetingMessage(item.text),
    );
  return { question: questionMessage?.text?.trim() ?? "" };
}

function parsePlatformArea(answer) {
  const normalized = answer
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (["crime", "cpp", "crime cpp", "common platform"].includes(normalized)) {
    return "crime";
  }
  if (
    ["other", "cloud native", "cloud native other", "cft", "sds"].includes(
      normalized,
    )
  ) {
    return "other";
  }
  return undefined;
}

async function getThreadMessages(client, message) {
  const threadTs = message.thread_ts ?? message.ts;
  const result = await client.conversations.replies({
    channel: message.channel,
    ts: threadTs,
    limit: 50,
    include_all_metadata: true,
  });

  return result.messages ?? [];
}

async function handleConversationMessage({
  message,
  client,
  say,
  setStatus,
  setTitle,
}) {
  const question = message.text?.trim();
  if (!question || message.bot_id) {
    return;
  }

  try {
    const threadMessages = await getThreadMessages(client, message);
    if (isClosedConversation(threadMessages)) {
      return;
    }
    const currentIndex = threadMessages.findIndex(
      (item) => item.ts === message.ts,
    );
    if (
      currentIndex >= 0 &&
      threadMessages.slice(currentIndex + 1).some(isBotMessage)
    ) {
      return;
    }
    if (
      await handleConversationalHelpReply({
        message,
        client,
        messages: threadMessages,
      })
    ) {
      return;
    }

    if (
      await handleClarificationReply({
        message,
        client,
        messages: threadMessages,
      })
    ) {
      return;
    }

    if (
      await handleJiraFeedback({ message, client, messages: threadMessages })
    ) {
      return;
    }

    if (
      await handleDocumentationFeedback({
        message,
        client,
        messages: threadMessages,
      })
    ) {
      return;
    }

    const pendingPlatform = pendingPlatformSelection(
      threadMessages,
      message.ts,
    );
    const greetingShown = greetingAlreadyShown(threadMessages);
    const orchestration = await orchestrateConversation({
      question,
      pendingPlatform,
      greetingShown,
    });
    if (orchestration.action === "reply") {
      const responseText = orchestration.promptPlatform
        ? /platform/i.test(orchestration.text)
          ? orchestration.text
          : `${orchestration.text.replace(/[.!?\s]+$/, "")}. Which platform do you need support with?`
        : orchestration.text;
      await say({
        text: responseText,
        ...(orchestration.promptPlatform
          ? {
              blocks: knowledgeSearchPromptBlocks(responseText),
              metadata: {
                event_type: "conversation_greeting",
                event_payload: {},
              },
            }
          : {}),
      });
      return;
    }

    const selectedPlatformArea = pendingPlatform
      ? parsePlatformArea(question)
      : undefined;
    if (pendingPlatform && !selectedPlatformArea) {
      await say({
        text: "Please reply with Crime / CPP or Cloud Native / Other.",
        blocks: knowledgeSearchPromptBlocks(),
      });
      return;
    }

    if (pendingPlatform && selectedPlatformArea && !pendingPlatform.question) {
      await say({
        text: "What issue can I help with?",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "What issue can I help with?",
            },
          },
          {
            type: "context",
            block_id: `knowledge_search_platform_selected_${selectedPlatformArea}`,
            elements: [
              {
                type: "mrkdwn",
                text: `Platform selected: *${selectedPlatformArea === "crime" ? "Crime / CPP" : "Cloud Native / Other"}*`,
              },
            ],
          },
        ],
        metadata: {
          event_type: "platform_selected",
          event_payload: { area: selectedPlatformArea },
        },
      });
      return;
    }

    if (
      /^(raise|create|open|submit|start).*(help request|support request|ticket)/i.test(
        question,
      )
    ) {
      await setTitle("Platform help request");
      await startConversationalHelpRequest({
        client,
        channelId: message.channel,
        threadTs: message.thread_ts ?? message.ts,
      });
      return;
    }

    await setStatus("Reading the conversation…");
    const messages = recentMessages(threadMessages);
    const area = selectedPlatformArea ?? extractAreaFromHistory(messages);
    const searchQuestion = pendingPlatform?.question ?? question;
    if (greetingShown && isGreetingMessage(question)) {
      await say({
        text: "What issue or question can I help with?",
      });
      return;
    }
    if (!area) {
      await setTitle(question.slice(0, 80));
      const platformPromptText = greetingShown
        ? "Which platform do you need support with?"
        : PLATFORM_PROMPT_TEXT;
      await say({
        text: platformPromptText,
        blocks: knowledgeSearchPromptBlocks(platformPromptText),
      });
      return;
    }

    await setStatus("Searching HMCTS documentation…");
    const conversation = conversationFromHistory(messages, message.ts);
    const result = await answerConversation({
      question: searchQuestion,
      area,
      conversation,
    });

    if (result.resultCount === 0) {
      await say({
        text: "I couldn’t find a relevant answer in HMCTS documentation. I’ll check similar JIRA tickets next.",
        blocks: [
          {
            type: "section",
            block_id: `knowledge_search_no_results_${area}`,
            text: {
              type: "mrkdwn",
              text: "I couldn’t find a relevant answer in HMCTS documentation. I’ll check similar JIRA tickets next.",
            },
          },
        ],
      });
      await continueAfterDocumentation({
        client,
        channelId: message.channel,
        threadTs: message.thread_ts ?? message.ts,
        question: searchQuestion,
        area,
        docsHadResults: false,
      });
      return;
    }

    await say({
      text: result.text,
      metadata: {
        event_type: "knowledge_search_answer",
        event_payload: {
          question: searchQuestion,
          area,
          result_count: result.resultCount,
        },
      },
      blocks: knowledgeSearchAnswerBlocks({
        answer: result.text,
        area,
      }),
    });
  } catch (error) {
    console.error("An error occurred while answering an agent message", error);
    await say(
      "Sorry, something went wrong while continuing this conversation. Please try that response again.",
    );
  }
}

async function handleAgentMessage({ message, client }) {
  const threadTs = message.thread_ts ?? message.ts;

  return handleConversationMessage({
    message,
    client,
    say: (response) =>
      client.chat.postMessage({
        ...(typeof response === "string" ? { text: response } : response),
        channel: message.channel,
        thread_ts: threadTs,
      }),
    setStatus: (status) =>
      client.assistant.threads.setStatus({
        channel_id: message.channel,
        thread_ts: threadTs,
        status,
      }),
    setTitle: (title) =>
      client.assistant.threads.setTitle({
        channel_id: message.channel,
        thread_ts: threadTs,
        title,
      }),
  });
}

async function handleAgentConversationAction({ body, action, client }) {
  const answers = {
    knowledge_search_conversation_platform_crime: "Crime / CPP",
    knowledge_search_conversation_platform_other: "Cloud Native / Other",
    knowledge_search_conversation_solved: "yes",
    knowledge_search_conversation_needs_help: "no",
    jira_search_conversation_useful: "yes",
    jira_search_conversation_not_useful: "no",
  };
  const answer = answers[action.action_id];
  if (!answer) return false;

  await client.chat.update({
    channel: body.channel.id,
    ts: body.message.ts,
    text: body.message.text,
    blocks: body.message.blocks.filter((block) => block.type !== "actions"),
  });

  await handleAgentMessage({
    message: {
      type: "message",
      channel: body.channel.id,
      channel_type: "im",
      thread_ts: body.message.thread_ts ?? body.message.ts,
      ts: body.action_ts ?? `${Date.now() / 1000}`,
      user: body.user.id,
      text: answer,
    },
    client,
  });
  return true;
}

module.exports.handleConversationMessage = handleConversationMessage;
module.exports.handleAgentMessage = handleAgentMessage;
module.exports.handleAgentConversationAction = handleAgentConversationAction;
module.exports.extractAreaFromHistory = extractAreaFromHistory;
module.exports.conversationFromHistory = conversationFromHistory;
module.exports.recentMessages = recentMessages;
module.exports.pendingPlatformSelection = pendingPlatformSelection;
module.exports.parsePlatformArea = parsePlatformArea;
module.exports.isClosedConversation = isClosedConversation;
