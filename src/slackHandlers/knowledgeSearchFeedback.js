const {
  knowledgeSearchAnswerBlocks,
  parseKnowledgeSearchActionValue,
} = require("../messages/knowledgeSearchAnswer");
const { postHelpForm } = require("./startHelpForm");

function getAnswerTextFromMessage(message) {
  return (
    message.blocks?.find((block) => block.type === "section")?.text?.text ??
    message.text ??
    ""
  );
}

function getFeedbackContext(message) {
  const actionValue = message.blocks
    ?.flatMap((block) => block.elements ?? [])
    .find((element) =>
      ["knowledge_search_solved", "knowledge_search_still_need_help"].includes(
        element.action_id,
      ),
    )?.value;

  return parseKnowledgeSearchActionValue(actionValue);
}

function hasReadSuggestion(body, action = {}) {
  const actionContext = parseKnowledgeSearchActionValue(action.value);

  if (!actionContext.requiresReadConfirmation) {
    return true;
  }

  if (actionContext.hasReadSuggestion) {
    return true;
  }

  const stateValues = Object.values(body.state?.values ?? {});

  return stateValues.some(
    (blockValues) =>
      Object.entries(blockValues).some(
        ([actionId, element]) =>
          actionId === "knowledge_search_read_suggestion" &&
          element.selected_options?.some(
            (option) => option.value === "read_suggestion",
          ),
      ) ||
      Object.values(blockValues).some(
        (element) =>
          element.action_id === "knowledge_search_read_suggestion" &&
          element.selected_options?.some(
            (option) => option.value === "read_suggestion",
          ),
      ),
  );
}

async function handleKnowledgeSearchReadSuggestion(client, body, action) {
  const { area, question } = getFeedbackContext(body.message);
  const answer = getAnswerTextFromMessage(body.message);
  const readSuggestion = action.selected_options?.some(
    (option) => option.value === "read_suggestion",
  );

  await client.chat.update({
    channel: body.channel.id,
    ts: body.message.ts,
    text: body.message.text,
    blocks: knowledgeSearchAnswerBlocks({
      answer,
      area,
      question,
      hasReadSuggestion: readSuggestion,
    }),
  });
}

async function handleKnowledgeSearchSolved(client, body, action) {
  const { area, question } = parseKnowledgeSearchActionValue(action.value);
  const answer = getAnswerTextFromMessage(body.message);

  await client.chat.update({
    channel: body.channel.id,
    ts: body.message.ts,
    text: body.message.text,
    blocks: knowledgeSearchAnswerBlocks({
      answer,
      area,
      question,
      state: "solved",
    }),
  });
}

async function handleKnowledgeSearchStillNeedHelp(client, body, action) {
  const { area, question } = parseKnowledgeSearchActionValue(action.value);
  const answer = getAnswerTextFromMessage(body.message);

  if (!hasReadSuggestion(body, action)) {
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: body.message.text,
      blocks: knowledgeSearchAnswerBlocks({
        answer,
        area,
        question,
        errorMessage:
          "Please confirm you have read the suggestion before raising a help request.",
      }),
    });
    return;
  }

  await client.chat.update({
    channel: body.channel.id,
    ts: body.message.ts,
    text: body.message.text,
    blocks: knowledgeSearchAnswerBlocks({
      answer,
      area,
      question,
      state: "needs_help",
    }),
  });

  await postHelpForm({
    client,
    channelId: body.channel.id,
    userId: body.user.id,
    area,
    helpRequest: {
      description: question,
    },
    formSource: "knowledge_search",
  });
}

module.exports.handleKnowledgeSearchSolved = handleKnowledgeSearchSolved;
module.exports.handleKnowledgeSearchReadSuggestion =
  handleKnowledgeSearchReadSuggestion;
module.exports.handleKnowledgeSearchStillNeedHelp =
  handleKnowledgeSearchStillNeedHelp;
module.exports.getFeedbackContext = getFeedbackContext;
module.exports.hasReadSuggestion = hasReadSuggestion;
