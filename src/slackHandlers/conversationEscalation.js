const {
  followUpQuestions,
  classifyClarificationReply,
  generateTicketSummary,
  analyticsRecommendations,
} = require("../ai/ai");
const { answerConversation } = require("../service/conversationKnowledge");
const { searchHelpRequests } = require("../service/searchHelpRequests");
const {
  relatedHelpRequestResultsText,
} = require("../messages/knowledgeAnswer");
const { stringTrim } = require("../messages/util");
const {
  startConversationalHelpRequest,
} = require("./conversationalHelpRequest");

const DOCUMENTATION_FEEDBACK_PREFIX = "knowledge_search_conversation_feedback_";
const JIRA_FEEDBACK_PREFIX = "jira_search_conversation_feedback_";
const CLARIFICATION_START_PREFIX = "help_clarification_start_";
const CLARIFICATION_QUESTION_PREFIX = "help_clarification_question_";
const MAX_CLARIFICATION_QUESTIONS = 4;
const FIRST_CLARIFICATION_QUESTION = "What have you already checked or tried?";

function blockId(message, prefix) {
  return message.blocks?.find((block) => block.block_id?.startsWith(prefix))
    ?.block_id;
}

function isBotMessage(message) {
  return Boolean(message.bot_id || message.app_id);
}

function messageText(message) {
  return message.text?.trim() ?? "";
}

function clarificationQuestion(message) {
  const savedQuestion = message.metadata?.event_payload?.question?.trim();
  if (savedQuestion) return savedQuestion;

  return messageText(message)
    .replace(/^\*?Question \d+ of up to \d+:\*?\s*/i, "")
    .replace(/^\*?\d+\/\d+\*?\s*·\s*/i, "")
    .split("\n")[0]
    .trim();
}

function isYes(answer) {
  return /^(yes|y|solved|fixed|useful|helpful|that worked|it worked)$/i.test(
    answer,
  );
}

function isNo(answer) {
  return /^(no|n|nope|not useful|not helpful|still need help)$/i.test(answer);
}

async function setStatus(client, channelId, threadTs, status) {
  if (!client.assistant?.threads?.setStatus) return;
  await client.assistant.threads.setStatus({
    channel_id: channelId,
    thread_ts: threadTs,
    status,
  });
}

async function postMarker({
  client,
  channelId,
  threadTs,
  id,
  text,
  metadata,
  actions = [],
}) {
  const blocks = [
    {
      type: "section",
      block_id: id,
      text: { type: "mrkdwn", text: stringTrim(text, 2900, "...") },
    },
  ];
  if (actions.length > 0) {
    blocks.push({ type: "actions", elements: actions });
  }
  return client.chat.postMessage({
    channel: channelId,
    thread_ts: threadTs,
    text,
    blocks,
    ...(metadata && { metadata }),
  });
}

function originalQuestion(messages, beforeIndex) {
  return messages
    .slice(0, beforeIndex)
    .find((message) => !isBotMessage(message) && messageText(message))
    ?.text.trim();
}

function feedbackStage(messages, prefix) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const id = blockId(messages[index], prefix);
    if (!id) continue;

    const closed = messages
      .slice(index + 1)
      .some((message) =>
        message.blocks?.some((block) =>
          [
            "knowledge_search_conversation_solved",
            "jira_search_conversation_solved",
            "jira_search_conversation_no_results",
            "help_request_conversation_complete",
            "help_request_conversation_cancelled",
          ].includes(block.block_id),
        ),
      );
    const movedForward = messages
      .slice(index + 1)
      .some(
        (message) =>
          blockId(message, CLARIFICATION_START_PREFIX) ||
          blockId(message, "help_request_conversation_start_") ||
          (prefix === DOCUMENTATION_FEEDBACK_PREFIX &&
            blockId(message, JIRA_FEEDBACK_PREFIX)),
      );
    if (!closed && !movedForward) {
      return {
        index,
        message: messages[index],
        area: id.slice(prefix.length),
      };
    }
    return null;
  }
  return null;
}

function jiraResultBlocks({ text, area }) {
  return [
    {
      type: "section",
      block_id: `jira_search_results_${area}`,
      expand: true,
      text: { type: "mrkdwn", text },
    },
    { type: "divider" },
    {
      type: "context",
      block_id: `${JIRA_FEEDBACK_PREFIX}${area}`,
      elements: [
        {
          type: "mrkdwn",
          text: "*Are any of these tickets useful for your issue?*",
        },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Yes, useful" },
          style: "primary",
          action_id: "jira_search_conversation_useful",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "No, not useful" },
          action_id: "jira_search_conversation_not_useful",
        },
      ],
    },
  ];
}

async function repeatFeedbackQuestion({ client, message, stage, kind }) {
  const documentation = kind === "documentation";
  const text = documentation
    ? "Did the documentation solve the problem? Reply `yes` or `no`, or use a button."
    : "Are any of the JIRA tickets useful? Reply `yes` or `no`, or use a button.";
  const existingBlocks = stage.message.blocks;
  if (client.chat.update && existingBlocks?.length) {
    const blocks = existingBlocks.map((block) => {
      if (
        !block.block_id?.startsWith(
          documentation ? DOCUMENTATION_FEEDBACK_PREFIX : JIRA_FEEDBACK_PREFIX,
        )
      ) {
        return block;
      }
      return {
        ...block,
        type: "section",
        text: { type: "mrkdwn", text },
      };
    });
    await client.chat.update({
      channel: message.channel,
      ts: stage.message.ts,
      text,
      blocks,
    });
    return;
  }
  await client.chat.postMessage({
    channel: message.channel,
    thread_ts: message.thread_ts ?? message.ts,
    text,
    blocks: [
      {
        type: "section",
        block_id: `${documentation ? DOCUMENTATION_FEEDBACK_PREFIX : JIRA_FEEDBACK_PREFIX}${stage.area}`,
        text: { type: "mrkdwn", text },
      },
      {
        type: "actions",
        elements: documentation
          ? [
              {
                type: "button",
                text: { type: "plain_text", text: "Yes, solved" },
                style: "primary",
                action_id: "knowledge_search_conversation_solved",
              },
              {
                type: "button",
                text: { type: "plain_text", text: "No, I still need help" },
                action_id: "knowledge_search_conversation_needs_help",
              },
            ]
          : [
              {
                type: "button",
                text: { type: "plain_text", text: "Yes, useful" },
                style: "primary",
                action_id: "jira_search_conversation_useful",
              },
              {
                type: "button",
                text: { type: "plain_text", text: "No, not useful" },
                action_id: "jira_search_conversation_not_useful",
              },
            ],
      },
    ],
    ...(stage.message.metadata && { metadata: stage.message.metadata }),
  });
}

async function beginClarification({
  client,
  channelId,
  threadTs,
  question,
  area,
  docsHadResults,
  jiraHadResults,
}) {
  await postMarker({
    client,
    channelId,
    threadTs,
    id: `${CLARIFICATION_START_PREFIX}${area}_d${docsHadResults ? 1 : 0}_j${jiraHadResults ? 1 : 0}`,
    text: "I need some further information to help you.",
    metadata: {
      event_type: "help_clarification_started",
      event_payload: {
        question,
        area,
        docs_had_results: Boolean(docsHadResults),
        jira_had_results: Boolean(jiraHadResults),
      },
    },
  });

  await postMarker({
    client,
    channelId,
    threadTs,
    id: `${CLARIFICATION_QUESTION_PREFIX}1`,
    text: FIRST_CLARIFICATION_QUESTION,
    metadata: {
      event_type: "help_clarification_question",
      event_payload: {
        number: 1,
        question: FIRST_CLARIFICATION_QUESTION,
      },
    },
  });
}

function clarificationInput(session, answers) {
  const details = answers
    .map(
      ({ question, answer }, index) =>
        `${index + 1}. ${question}\nAnswer: ${answer}`,
    )
    .join("\n\n");
  return [
    `Original request:\n${session.question}`,
    details ? `Information already collected:\n${details}` : undefined,
    "Return only questions whose answers are still missing. Do not repeat any question already asked.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function normalizedQuestion(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isInvestigationQuestion(question) {
  const normalized = normalizedQuestion(question);
  return (
    /\bwhat have you\b/.test(normalized) &&
    /\b(check|checked|try|tried|done|investigat)/.test(normalized)
  );
}

async function askNextQuestion({
  client,
  channelId,
  threadTs,
  session,
  answers,
}) {
  if (answers.length >= MAX_CLARIFICATION_QUESTIONS) {
    await retrySearchesAndStartTicket({
      client,
      channelId,
      threadTs,
      session,
      answers,
    });
    return;
  }

  let suggestions = [];
  try {
    await setStatus(client, channelId, threadTs, "Choosing the next question…");
    suggestions = await followUpQuestions(clarificationInput(session, answers));
    if (!Array.isArray(suggestions)) suggestions = [];
  } catch (error) {
    console.error("Could not generate a clarification question", error);
  }

  const asked = new Set(
    answers.map(({ question }) => normalizedQuestion(question)),
  );
  const investigationAlreadyAsked = answers.some(({ question }) =>
    isInvestigationQuestion(question),
  );
  const suggestion = suggestions.find(
    (item) =>
      item?.question &&
      !asked.has(normalizedQuestion(item.question)) &&
      !(investigationAlreadyAsked && isInvestigationQuestion(item.question)),
  );
  if (!suggestion) {
    await retrySearchesAndStartTicket({
      client,
      channelId,
      threadTs,
      session,
      answers,
    });
    return;
  }

  const number = answers.length + 1;
  await postMarker({
    client,
    channelId,
    threadTs,
    id: `${CLARIFICATION_QUESTION_PREFIX}${number}`,
    text: suggestion.question,
    metadata: {
      event_type: "help_clarification_question",
      event_payload: {
        number,
        question: suggestion.question,
      },
    },
  });
}

function activeClarification(messages) {
  let startIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (blockId(messages[index], CLARIFICATION_START_PREFIX)) {
      startIndex = index;
      break;
    }
  }
  if (startIndex < 0) return null;

  const later = messages.slice(startIndex + 1);
  if (
    later.some(
      (message) =>
        blockId(message, "help_request_conversation_start_") ||
        blockId(message, "help_clarification_complete"),
    )
  ) {
    return null;
  }

  const payload = messages[startIndex].metadata?.event_payload ?? {};
  const startId = blockId(messages[startIndex], CLARIFICATION_START_PREFIX);
  const savedState = new RegExp(
    `^${CLARIFICATION_START_PREFIX}(crime|other)(?:_d([01])_j([01]))?$`,
  ).exec(startId);
  const area = payload.area ?? savedState?.[1];
  return {
    startIndex,
    question:
      payload.question ??
      messages.find((message) => !isBotMessage(message) && messageText(message))
        ?.text ??
      "",
    area,
    docsHadResults:
      payload.docs_had_results === true ||
      savedState?.[2] === "1" ||
      messages
        .slice(0, startIndex)
        .some((message) => blockId(message, DOCUMENTATION_FEEDBACK_PREFIX)),
    jiraHadResults:
      payload.jira_had_results === true ||
      savedState?.[3] === "1" ||
      messages
        .slice(0, startIndex)
        .some((message) => blockId(message, JIRA_FEEDBACK_PREFIX)),
  };
}

function collectedClarificationAnswers(messages, session, excludedTs) {
  const answers = [];
  for (
    let index = session.startIndex + 1;
    index < messages.length;
    index += 1
  ) {
    const promptId = blockId(messages[index], CLARIFICATION_QUESTION_PREFIX);
    if (!promptId) continue;
    const question = clarificationQuestion(messages[index]);
    if (!question) continue;
    const reply = messages
      .slice(index + 1)
      .find(
        (message) =>
          message.ts !== excludedTs &&
          !isBotMessage(message) &&
          messageText(message),
      );
    if (reply) {
      answers.push({
        question,
        answer: messageText(reply),
      });
    }
  }
  return answers.slice(0, MAX_CLARIFICATION_QUESTIONS);
}

function enrichedQuestion(session, answers) {
  if (answers.length === 0) return session.question;
  return `${session.question}\n\nAdditional information:\n${answers
    .map(({ question, answer }) => `- ${question} ${answer}`)
    .join("\n")}`;
}

function ticketDescription(session, answers) {
  if (answers.length === 0) return session.question;
  return `${session.question}\n\nAdditional information:\n${answers
    .map(({ question, answer }) => `- ${question} ${answer}`)
    .join("\n")}`;
}

function extractUserLinks(input) {
  const normalizedSlackLinks = input.replace(
    /<(https?:\/\/[^|>]+)(?:\|[^>]*)?>/g,
    "$1",
  );
  const matches = normalizedSlackLinks.match(/https?:\/\/[^\s<>()|>]+/g) ?? [];
  return [...new Set(matches.map((url) => url.replace(/[.,;:!?]+$/, "")))]
    .slice(0, 10)
    .join("\n");
}

function fallbackTicketSummary(question) {
  return question
    .split("\n")[0]
    .replace(/^Original request:\s*/i, "")
    .trim()
    .slice(0, 255);
}

async function retrySearchesAndStartTicket({
  client,
  channelId,
  threadTs,
  session,
  answers,
}) {
  await postMarker({
    client,
    channelId,
    threadTs,
    id: "help_clarification_complete",
    text: "Thanks — checking again with those details…",
  });
  const query = enrichedQuestion(session, answers);
  const description = ticketDescription(session, answers);
  const initialPrBuildUrl = extractUserLinks(query);
  const retryFailures = [];

  if (!session.docsHadResults) {
    try {
      await setStatus(
        client,
        channelId,
        threadTs,
        "Searching HMCTS documentation again…",
      );
      const docs = await answerConversation({
        question: query,
        area: session.area,
      });
      if (docs.resultCount > 0) {
        await postMarker({
          client,
          channelId,
          threadTs,
          id: `knowledge_search_retry_results_${session.area}`,
          text: `*New documentation results found with the extra details*\n\n${docs.text}`,
        });
      }
    } catch (error) {
      console.error("Could not retry the documentation search", error);
      retryFailures.push("HMCTS documentation");
    }
  }

  if (!session.jiraHadResults) {
    try {
      await setStatus(
        client,
        channelId,
        threadTs,
        "Searching similar JIRA tickets again…",
      );
      const issues = await searchHelpRequests(query, session.area);
      if (issues.length > 0) {
        await postMarker({
          client,
          channelId,
          threadTs,
          id: `jira_search_retry_results_${session.area}`,
          text: `*New similar JIRA tickets found with the extra details*\n\n${relatedHelpRequestResultsText(issues)}`,
        });
      }
    } catch (error) {
      console.error("Could not retry the JIRA search", error);
      retryFailures.push("similar JIRA tickets");
    }
  }

  if (retryFailures.length > 0) {
    await postMarker({
      client,
      channelId,
      threadTs,
      id: "help_retry_search_failed",
      text: `I couldn’t complete the retry against ${retryFailures.join(
        " or ",
      )}. I’ll continue preparing a help request using the information you provided.`,
    });
  }

  let initialSummary = fallbackTicketSummary(session.question);
  try {
    await setStatus(client, channelId, threadTs, "Drafting the help request…");
    initialSummary = (await generateTicketSummary(query)) || initialSummary;
  } catch (error) {
    console.error("Could not generate the ticket summary", error);
  }

  let initialRecommendations = {};
  try {
    await setStatus(
      client,
      channelId,
      threadTs,
      "Classifying the help request…",
    );
    initialRecommendations = await analyticsRecommendations(
      query,
      session.area,
    );
  } catch (error) {
    console.error("Could not classify the ticket fields", error);
  }

  await startConversationalHelpRequest({
    client,
    channelId,
    threadTs,
    area: session.area,
    initialSummary,
    initialDescription: description,
    initialPrBuildUrl,
    initialAnalysis: "",
    initialRecommendations,
    followUpAnswers: answers,
  });
}

async function searchJiraOrClarify({
  client,
  channelId,
  threadTs,
  question,
  area,
  docsHadResults,
}) {
  let issues = [];
  try {
    await setStatus(
      client,
      channelId,
      threadTs,
      "Searching similar JIRA tickets…",
    );
    issues = await searchHelpRequests(question, area);
  } catch (error) {
    console.error("Could not search similar JIRA tickets", error);
  }

  if (issues.length === 0) {
    await postMarker({
      client,
      channelId,
      threadTs,
      id: "jira_search_conversation_no_results",
      text: "I couldn’t find a similar JIRA ticket, so I’ll ask a few focused questions.",
    });
    await beginClarification({
      client,
      channelId,
      threadTs,
      question,
      area,
      docsHadResults,
      jiraHadResults: false,
    });
    return;
  }

  const text = relatedHelpRequestResultsText(issues);
  await client.chat.postMessage({
    channel: channelId,
    thread_ts: threadTs,
    text,
    blocks: jiraResultBlocks({ text, area }),
    metadata: {
      event_type: "jira_search_results",
      event_payload: {
        question,
        area,
        docs_had_results: Boolean(docsHadResults),
        result_count: issues.length,
      },
    },
  });
}

async function continueAfterDocumentation({
  client,
  channelId,
  threadTs,
  question,
  area,
  docsHadResults,
}) {
  await searchJiraOrClarify({
    client,
    channelId,
    threadTs,
    question,
    area,
    docsHadResults,
  });
}

async function handleDocumentationFeedback({ message, client, messages }) {
  const stage = feedbackStage(messages, DOCUMENTATION_FEEDBACK_PREFIX);
  if (!stage) return false;
  const answer = messageText(message);
  if (!isYes(answer) && !isNo(answer)) {
    await repeatFeedbackQuestion({
      client,
      message,
      stage,
      kind: "documentation",
    });
    return true;
  }

  const threadTs = message.thread_ts ?? message.ts;
  if (isYes(answer)) {
    await postMarker({
      client,
      channelId: message.channel,
      threadTs,
      id: "knowledge_search_conversation_solved",
      text: "Great — I’ve marked this as solved and closed this thread. Start a new message if you need help with something else.",
    });
    return true;
  }

  const payload = stage.message.metadata?.event_payload ?? {};
  await searchJiraOrClarify({
    client,
    channelId: message.channel,
    threadTs,
    question:
      payload.question ?? originalQuestion(messages, stage.index) ?? answer,
    area: payload.area ?? stage.area,
    docsHadResults: (payload.result_count ?? 1) > 0,
  });
  return true;
}

async function handleJiraFeedback({ message, client, messages }) {
  const stage = feedbackStage(messages, JIRA_FEEDBACK_PREFIX);
  if (!stage) return false;
  const answer = messageText(message);
  if (!isYes(answer) && !isNo(answer)) {
    await repeatFeedbackQuestion({ client, message, stage, kind: "jira" });
    return true;
  }

  const threadTs = message.thread_ts ?? message.ts;
  if (isYes(answer)) {
    await postMarker({
      client,
      channelId: message.channel,
      threadTs,
      id: "jira_search_conversation_solved",
      text: "Great — I’m glad one of those tickets helped. This thread is now closed; start a new message if you need anything else.",
    });
    return true;
  }

  const payload = stage.message.metadata?.event_payload ?? {};
  await beginClarification({
    client,
    channelId: message.channel,
    threadTs,
    question:
      payload.question ?? originalQuestion(messages, stage.index) ?? answer,
    area: payload.area ?? stage.area,
    docsHadResults:
      payload.docs_had_results === true ||
      messages
        .slice(0, stage.index)
        .some((item) => blockId(item, DOCUMENTATION_FEEDBACK_PREFIX)),
    jiraHadResults: true,
  });
  return true;
}

async function handleClarificationReply({ message, client, messages }) {
  const session = activeClarification(messages);
  if (!session) return false;
  const answer = messageText(message);
  if (!answer) return true;

  const previousAnswers = collectedClarificationAnswers(
    messages,
    session,
    message.ts,
  );
  const latestQuestionMessage = [...messages]
    .reverse()
    .find((item) => blockId(item, CLARIFICATION_QUESTION_PREFIX));
  const latestQuestion = clarificationQuestion(latestQuestionMessage ?? {});
  if (!latestQuestion) return false;

  let replyType = "answer";
  try {
    replyType = await classifyClarificationReply({
      question: latestQuestion,
      answer,
      context: clarificationInput(session, previousAnswers),
    });
  } catch (error) {
    console.warn(
      "Could not classify clarification reply; treating it as an answer",
      error,
    );
  }

  if (replyType === "new_question") {
    await postMarker({
      client,
      channelId: message.channel,
      threadTs: message.thread_ts ?? message.ts,
      id: `help_clarification_new_question_${Date.now()}`,
      text: "This sounds like a new question. Please start a new message so I can keep its context separate.",
    });
    return true;
  }

  if (replyType === "clarification_request" || replyType === "unrelated") {
    const prompt =
      replyType === "clarification_request"
        ? `No problem — please answer this in your own words:\n${latestQuestion}`
        : `That does not seem to answer the current question. Please answer this one, or reply skip:\n${latestQuestion}`;
    await postMarker({
      client,
      channelId: message.channel,
      threadTs: message.thread_ts ?? message.ts,
      id: `${CLARIFICATION_QUESTION_PREFIX}${previousAnswers.length + 1}`,
      text: prompt,
      metadata: {
        event_type: "help_clarification_question",
        event_payload: {
          number: previousAnswers.length + 1,
          question: latestQuestion,
        },
      },
    });
    return true;
  }

  const answers = [
    ...previousAnswers,
    {
      question: latestQuestion,
      answer: replyType === "skip" ? "Skipped" : answer,
    },
  ].slice(0, MAX_CLARIFICATION_QUESTIONS);
  await askNextQuestion({
    client,
    channelId: message.channel,
    threadTs: message.thread_ts ?? message.ts,
    session,
    answers,
  });
  return true;
}

module.exports.continueAfterDocumentation = continueAfterDocumentation;
module.exports.handleDocumentationFeedback = handleDocumentationFeedback;
module.exports.handleJiraFeedback = handleJiraFeedback;
module.exports.handleClarificationReply = handleClarificationReply;
module.exports.searchJiraOrClarify = searchJiraOrClarify;
module.exports.activeClarification = activeClarification;
module.exports.collectedClarificationAnswers = collectedClarificationAnswers;
module.exports.extractUserLinks = extractUserLinks;
module.exports.INVESTIGATION_QUESTION = FIRST_CLARIFICATION_QUESTION;
