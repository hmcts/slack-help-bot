const { environments, teams, areas } = require("../messages/helpFormData");
const {
  submitConversationalHelpRequest,
} = require("./submitConversationalHelpRequest");
const appInsights = require("../modules/appInsights");

const START_BLOCK_PREFIX = "help_request_conversation_start_";
const PROMPT_BLOCK_PREFIX = "help_request_conversation_prompt_";
const ANSWER_BLOCK_PREFIX = "help_request_conversation_answer_";
const TERMINAL_BLOCK_IDS = new Set([
  "help_request_conversation_complete",
  "help_request_conversation_cancelled",
]);

function blockId(message, prefix) {
  return message.blocks?.find((block) => block.block_id?.startsWith(prefix))
    ?.block_id;
}

function messageText(message) {
  return message.text?.trim() ?? "";
}

function markedBlockText(message, id) {
  return message.blocks?.find((block) => block.block_id === id)?.text?.text;
}

function savedDraftOption(message, step) {
  const prefix = `help_request_conversation_draft_${step}_`;
  return blockId(message, prefix)?.slice(prefix.length);
}

function clarificationQuestion(message) {
  return (
    message.metadata?.event_payload?.question ??
    messageText(message)
      .replace(/^\*?Question \d+ of up to \d+:\*?\s*/i, "")
      .replace(/^\*?\d+\/\d+\*?\s*·\s*/i, "")
      .split("\n")[0]
      .trim()
  );
}

function draftFromEarlierThread(messages, startIndex) {
  let clarificationStart = -1;
  for (let index = startIndex - 1; index >= 0; index -= 1) {
    if (blockId(messages[index], "help_clarification_start_")) {
      clarificationStart = index;
      break;
    }
  }
  if (clarificationStart < 0) return {};

  const originalQuestion =
    messages[clarificationStart].metadata?.event_payload?.question ??
    messages
      .slice(0, clarificationStart)
      .find((message) => !isBotMessage(message) && messageText(message))
      ?.text ??
    "";
  const answers = [];
  for (let index = clarificationStart + 1; index < startIndex; index += 1) {
    if (!blockId(messages[index], "help_clarification_question_")) continue;
    const question = clarificationQuestion(messages[index]);
    const reply = messages
      .slice(index + 1, startIndex)
      .find((message) => !isBotMessage(message) && messageText(message));
    if (question && reply) {
      answers.push({ question, answer: messageText(reply) });
    }
  }
  const description = answers.length
    ? `${originalQuestion}\n\nAdditional information:\n${answers
        .map(({ question, answer }) => `- ${question} ${answer}`)
        .join("\n")}`
    : originalQuestion;
  const links = [
    ...new Set(description.match(/https?:\/\/[^\s<>()|>]+/g) ?? []),
  ]
    .map((url) => url.replace(/[.,;:!?]+$/, ""))
    .slice(0, 10)
    .join("\n");
  return { description, links, analysis: "", answers };
}

function recordedAnswer(message) {
  const saved = message.metadata?.event_payload?.answer;
  if (saved) return saved;

  const visible = messageText(message)
    .replace(/^Selected:\s*/i, "")
    .trim();
  return /^Skipped$/i.test(visible) ? "skip" : visible;
}

function isBotMessage(message) {
  return Boolean(message.bot_id || message.app_id);
}

function platformAreaFromStart(message) {
  const area =
    message.metadata?.event_payload?.area ??
    blockId(message, START_BLOCK_PREFIX)?.slice(START_BLOCK_PREFIX.length);
  return area === "unselected" ? undefined : area;
}

function findActiveSession(messages) {
  let startIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (blockId(messages[index], START_BLOCK_PREFIX)) {
      startIndex = index;
      break;
    }
  }

  if (startIndex < 0) {
    return null;
  }

  const sessionMessages = messages.slice(startIndex);
  if (
    sessionMessages.some((message) =>
      message.blocks?.some((block) => TERMINAL_BLOCK_IDS.has(block.block_id)),
    )
  ) {
    return null;
  }

  const startMessage = messages[startIndex];
  const earlierDraft = draftFromEarlierThread(messages, startIndex);
  const reviewMessage = [...sessionMessages]
    .reverse()
    .find((message) => blockId(message, `${PROMPT_BLOCK_PREFIX}confirmation`));
  const reviewState = reviewMessage?.metadata?.event_payload?.review_state;
  return {
    startIndex,
    startMessage,
    reviewState,
    platformArea: platformAreaFromStart(startMessage),
    initialDescription:
      startMessage.metadata?.event_payload?.initial_description ??
      markedBlockText(
        startMessage,
        "help_request_conversation_draft_description",
      )
        ?.replace(/^\*Description:\*\s*/, "")
        .trim() ??
      earlierDraft.description ??
      "",
    initialSummary:
      startMessage.metadata?.event_payload?.initial_summary ??
      markedBlockText(startMessage, "help_request_conversation_draft_summary")
        ?.replace(/^\*Draft summary:\*\s*/, "")
        .trim() ??
      "",
    initialPrBuildUrl:
      startMessage.metadata?.event_payload?.initial_pr_build_url ??
      markedBlockText(startMessage, "help_request_conversation_draft_links")
        ?.replace(/^\*Links found in the conversation:\*\s*/, "")
        .trim() ??
      earlierDraft.links ??
      "",
    initialAnalysis:
      startMessage.metadata?.event_payload?.initial_analysis ??
      markedBlockText(startMessage, "help_request_conversation_draft_analysis")
        ?.replace(/^\*Already checked:\*\s*/, "")
        .trim() ??
      earlierDraft.analysis ??
      "",
    initialEnvironment:
      startMessage.metadata?.event_payload?.initial_environment ??
      savedDraftOption(startMessage, "environment"),
    initialTeam:
      startMessage.metadata?.event_payload?.initial_team ??
      savedDraftOption(startMessage, "team"),
    initialArea:
      startMessage.metadata?.event_payload?.initial_area ??
      savedDraftOption(startMessage, "area"),
    followUpAnswers:
      startMessage.metadata?.event_payload?.follow_up_answers ??
      earlierDraft.answers ??
      [],
  };
}

function normalize(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function optionName(option) {
  return option.text.text;
}

function matchOption(answer, options) {
  const wanted = normalize(answer);
  const exact = options.find(
    (option) =>
      normalize(optionName(option)) === wanted ||
      normalize(option.value) === wanted,
  );
  if (exact) {
    return exact;
  }

  const partial = options.filter(
    (option) =>
      normalize(optionName(option)).startsWith(wanted) ||
      wanted.startsWith(normalize(optionName(option))) ||
      normalize(optionName(option)).includes(wanted) ||
      wanted.includes(normalize(optionName(option))),
  );
  return partial.length === 1 ? partial[0] : undefined;
}

function optionsFor(step, platformArea) {
  if (step === "platformArea") {
    return [
      {
        text: { type: "plain_text", text: "Crime / CPP", emoji: true },
        value: "crime",
      },
      {
        text: {
          type: "plain_text",
          text: "Cloud Native / Other",
          emoji: true,
        },
        value: "other",
      },
    ];
  }
  if (step === "environment") return environments(platformArea);
  if (step === "team") return teams(platformArea);
  if (step === "area") return areas(platformArea);
  return [];
}

function validateAnswer(step, answer, platformArea) {
  const trimmed = answer.trim();
  if (step === "summary") {
    if (!trimmed) return { error: "Please give me a short summary." };
    return { value: trimmed.slice(0, 255) };
  }
  if (step === "description") {
    if (!trimmed) return { error: "Please describe the issue." };
    return { value: trimmed };
  }
  if (step === "prBuildUrl" || step === "analysis") {
    return {
      value: /^(skip|none|n\/a|no)$/i.test(trimmed) ? "" : trimmed,
    };
  }
  if (["platformArea", "environment", "team", "area"].includes(step)) {
    const options = optionsFor(step, platformArea);
    const option = matchOption(trimmed, options);
    if (!option) {
      return {
        error: `I couldn't match that ${step}. Please choose from the dropdown or type the exact name.`,
      };
    }
    return { value: option };
  }
  return { value: trimmed };
}

function buildState(messages, session, excludedTs) {
  const savedReview = session.reviewState ?? {};
  const savedPlatformArea = savedReview.platform_area ?? session.platformArea;
  const state = {
    ...(savedPlatformArea && {
      platformArea: optionsFor("platformArea").find(
        (option) => option.value === savedPlatformArea,
      ),
    }),
    ...((savedReview.description ?? session.initialDescription) && {
      description: savedReview.description ?? session.initialDescription,
    }),
    ...((savedReview.summary ?? session.initialSummary) && {
      summary: savedReview.summary ?? session.initialSummary,
    }),
    ...((savedReview.links ?? session.initialPrBuildUrl) && {
      prBuildUrl: savedReview.links ?? session.initialPrBuildUrl,
    }),
    ...((savedReview.analysis ?? session.initialAnalysis) && {
      analysis: savedReview.analysis ?? session.initialAnalysis,
    }),
    ...((savedReview.environment ?? session.initialEnvironment) && {
      environment: optionsFor("environment", savedPlatformArea).find(
        (option) =>
          option.value ===
          (savedReview.environment ?? session.initialEnvironment),
      ),
    }),
    ...((savedReview.team ?? session.initialTeam) && {
      team: optionsFor("team", savedPlatformArea).find(
        (option) => option.value === (savedReview.team ?? session.initialTeam),
      ),
    }),
    ...((savedReview.area ?? session.initialArea) && {
      area: optionsFor("area", savedPlatformArea).find(
        (option) => option.value === (savedReview.area ?? session.initialArea),
      ),
    }),
  };
  let promptStep;

  for (const message of messages.slice(session.startIndex + 1)) {
    if (message.ts === excludedTs) continue;
    const recordedAnswerId = blockId(message, ANSWER_BLOCK_PREFIX);
    if (recordedAnswerId) {
      const step = recordedAnswerId.slice(ANSWER_BLOCK_PREFIX.length);
      const answer = recordedAnswer(message);
      if (step !== "confirmation") {
        const result = validateAnswer(
          step,
          answer,
          state.platformArea?.value ?? session.platformArea,
        );
        if (!result.error) state[step] = result.value;
      }
      promptStep = undefined;
      continue;
    }
    const promptId = blockId(message, PROMPT_BLOCK_PREFIX);
    if (promptId) {
      promptStep = promptId.slice(PROMPT_BLOCK_PREFIX.length);
      continue;
    }
    if (promptStep && !isBotMessage(message) && messageText(message)) {
      if (promptStep !== "confirmation") {
        const result = validateAnswer(
          promptStep,
          messageText(message),
          state.platformArea?.value ?? session.platformArea,
        );
        if (!result.error) {
          state[promptStep] = result.value;
        }
      }
      promptStep = undefined;
    }
  }

  return state;
}

function latestPromptStep(messages, session) {
  for (
    let index = messages.length - 1;
    index > session.startIndex;
    index -= 1
  ) {
    const id = blockId(messages[index], PROMPT_BLOCK_PREFIX);
    if (id) return id.slice(PROMPT_BLOCK_PREFIX.length);
  }
  return undefined;
}

function nextStep(state) {
  return [
    "platformArea",
    "summary",
    "description",
    "environment",
    "team",
    "area",
  ].find((step) => state[step] === undefined);
}

function promptText(step, platformArea, error) {
  const prefix = error ? `${error}\n\n` : "";
  const prompts = {
    platformArea:
      "Which platform is this request for? Choose below or type the name.",
    summary: "What short summary should I use for the help request?",
    description:
      "Please describe what is happening, what you expected, and any relevant error message.",
    prBuildUrl:
      "Send the replacement links, or reply `none` to remove all links.",
    analysis: "What have you already checked or tried?",
    environment: "Which environment is affected? Choose or type the name.",
    team: "Which team owns the affected service? Choose or type the name.",
    area: "Which technical area best describes the issue? Choose or type the name.",
  };
  return `${prefix}${prompts[step]}`;
}

function formatValue(value) {
  return (value?.text?.text ?? value) || "Not provided";
}

async function postMarkedMessage({
  client,
  channelId,
  threadTs,
  blockId,
  text,
}) {
  return client.chat.postMessage({
    channel: channelId,
    ...(threadTs && { thread_ts: threadTs }),
    text,
    blocks: [
      {
        type: "section",
        block_id: blockId,
        text: { type: "mrkdwn", text },
      },
    ],
  });
}

function reviewEditButton(field) {
  return {
    type: "button",
    text: { type: "plain_text", text: "Edit" },
    action_id: `help_request_conversation_edit_${field}`,
  };
}

function reviewTextField(blockId, label, value, field) {
  const displayValue =
    label === "Description"
      ? String(value || "Not provided").replace(
          /^Additional information:/m,
          "*Additional information:*",
        )
      : String(value || "Not provided");
  return {
    type: "section",
    block_id: blockId,
    text: {
      type: "mrkdwn",
      text: `*${label}*\n${displayValue.slice(0, 2850)}`,
    },
    accessory: reviewEditButton(field),
  };
}

function reviewStateMetadata(state) {
  return {
    event_type: "help_request_conversation_review",
    event_payload: {
      review_state: {
        summary: String(state.summary ?? "").slice(0, 255),
        description: String(state.description ?? "").slice(0, 1400),
        links: String(state.prBuildUrl ?? "").slice(0, 500),
        analysis: String(state.analysis ?? "").slice(0, 700),
        ...(state.platformArea && { platform_area: state.platformArea.value }),
        ...(state.environment && { environment: state.environment.value }),
        ...(state.team && { team: state.team.value }),
        ...(state.area && { area: state.area.value }),
      },
    },
  };
}

async function postPrompt({
  client,
  channelId,
  threadTs,
  step,
  platformArea,
  error,
  state,
  updateTs,
}) {
  if (step === "confirmation") {
    const reviewSelect = (field, label, value) => ({
      type: "section",
      block_id: `help_request_conversation_review_${field}`,
      text: { type: "mrkdwn", text: `*${label}*` },
      accessory: {
        type: "static_select",
        placeholder: {
          type: "plain_text",
          text: label,
        },
        action_id: `help_request_conversation_review_select_${field}`,
        options: optionsFor(field, platformArea),
        ...(value && { initial_option: value }),
      },
    });
    const blocks = [
      {
        type: "section",
        block_id: `${PROMPT_BLOCK_PREFIX}confirmation`,
        text: {
          type: "mrkdwn",
          text: `${error ? `${error}\n\n` : ""}*Review your help request*\nCheck the details below, then submit or edit any field.`,
        },
      },
      reviewTextField(
        "help_request_conversation_review_summary",
        "Summary",
        state.summary,
        "summary",
      ),
      { type: "divider" },
      reviewTextField(
        "help_request_conversation_review_description",
        "Description",
        state.description,
        "description",
      ),
      { type: "divider" },
      reviewTextField(
        "help_request_conversation_review_links",
        "Links",
        state.prBuildUrl,
        "prBuildUrl",
      ),
      { type: "divider" },
      reviewSelect("platformArea", "Platform", state.platformArea),
      reviewSelect("environment", "Environment", state.environment),
      reviewSelect("team", "Team", state.team),
      reviewSelect("area", "Technical area", state.area),
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Reply `yes` to submit or `cancel` to stop. Use the Edit buttons or dropdowns to change values.",
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Submit help request" },
            style: "primary",
            action_id: "help_request_conversation_confirm",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Cancel" },
            action_id: "help_request_conversation_cancel",
          },
        ],
      },
    ];
    const message = {
      channel: channelId,
      text: `Review help request: ${state.summary}`.slice(0, 2900),
      blocks,
      metadata: reviewStateMetadata(state),
    };
    if (updateTs) {
      await client.chat.update({
        channel: channelId,
        ts: updateTs,
        ...message,
      });
    } else {
      await client.chat.postMessage({
        ...message,
        ...(threadTs && { thread_ts: threadTs }),
      });
    }
    return;
  }

  const text = promptText(step, platformArea, error);
  const section = {
    type: "section",
    block_id: `${PROMPT_BLOCK_PREFIX}${step}`,
    text: { type: "mrkdwn", text },
  };
  if (["environment", "team", "area"].includes(step)) {
    section.accessory = {
      type: "static_select",
      placeholder: { type: "plain_text", text: `Select ${step}` },
      action_id: `help_request_conversation_select_${step}`,
      options: optionsFor(step, platformArea),
    };
  }

  const blocks = [section];
  if (step === "platformArea") {
    blocks.push({
      type: "actions",
      elements: optionsFor(step).map((option) => ({
        type: "button",
        text: option.text,
        action_id: `help_request_conversation_platform_${option.value}`,
      })),
    });
  } else if (step === "analysis") {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Skip" },
          action_id: `help_request_conversation_skip_${step}`,
        },
      ],
    });
  }

  await client.chat.postMessage({
    channel: channelId,
    ...(threadTs && { thread_ts: threadTs }),
    text,
    blocks,
  });
}

async function postFallbackPrompt({
  client,
  channelId,
  threadTs,
  step,
  platformArea,
  state,
}) {
  const text =
    step === "confirmation"
      ? [
          "*Review your help request*",
          `*Summary*\n${state.summary}`,
          `*Environment*\n${formatValue(state.environment)}`,
          `*Team*\n${formatValue(state.team)}`,
          `*Technical area*\n${formatValue(state.area)}`,
          "Reply `yes` to submit or `cancel` to stop. Use the Edit buttons or dropdowns to change values.",
        ].join("\n\n")
      : `${promptText(step, platformArea)}\n_Type your answer to continue._`;

  const blocks =
    step === "confirmation"
      ? [
          {
            type: "section",
            block_id: `${PROMPT_BLOCK_PREFIX}confirmation`,
            text: {
              type: "mrkdwn",
              text: "*Review your help request*\nCheck the details below, then submit or edit any text field.",
            },
          },
          reviewTextField(
            "help_request_conversation_review_summary",
            "Summary",
            state.summary,
            "summary",
          ),
          { type: "divider" },
          reviewTextField(
            "help_request_conversation_review_description",
            "Description",
            state.description,
            "description",
          ),
          { type: "divider" },
          reviewTextField(
            "help_request_conversation_review_links",
            "Links",
            state.prBuildUrl,
            "prBuildUrl",
          ),
          { type: "divider" },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Classification*\nPlatform: ${formatValue(state.platformArea)}\nEnvironment: ${formatValue(state.environment)}\nTeam: ${formatValue(state.team)}\nTechnical area: ${formatValue(state.area)}`,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "Submit help request" },
                style: "primary",
                action_id: "help_request_conversation_confirm",
              },
              {
                type: "button",
                text: { type: "plain_text", text: "Cancel" },
                action_id: "help_request_conversation_cancel",
              },
            ],
          },
        ]
      : [
          {
            type: "section",
            block_id: `${PROMPT_BLOCK_PREFIX}${step}`,
            text: { type: "mrkdwn", text: text.slice(0, 2900) },
          },
        ];

  await client.chat.postMessage({
    channel: channelId,
    ...(threadTs && { thread_ts: threadTs }),
    text: text.slice(0, 2900),
    blocks,
    ...(step === "confirmation" && { metadata: reviewStateMetadata(state) }),
  });
}

async function startConversationalHelpRequest({
  client,
  channelId,
  threadTs,
  area,
  initialSummary = "",
  initialDescription = "",
  initialPrBuildUrl = "",
  initialAnalysis = "",
  initialRecommendations = {},
  followUpAnswers = [],
}) {
  const environmentOptions = optionsFor("environment", area);
  const recommendedEnvironment = area
    ? (matchOption(
        String(initialRecommendations.environment ?? ""),
        environmentOptions,
      ) ??
      environmentOptions.find((option) => option.value === "not-applicable"))
    : undefined;
  const recommendedTeam = matchOption(
    String(initialRecommendations.team ?? ""),
    optionsFor("team", area),
  );
  const recommendedArea = matchOption(
    String(initialRecommendations.area ?? ""),
    optionsFor("area", area),
  );
  const recommendedOptions = [
    ["environment", recommendedEnvironment],
    ["team", recommendedTeam],
    ["area", recommendedArea],
  ].filter(([, option]) => option);
  const safeFollowUpAnswers = followUpAnswers.slice(0, 3).map((item) => ({
    question: String(item.question ?? "").slice(0, 180),
    answer: String(item.answer ?? "").slice(0, 500),
  }));

  const startResponse = await client.chat.postMessage({
    channel: channelId,
    ...(threadTs && { thread_ts: threadTs }),
    text: initialSummary
      ? "A few final details before review."
      : "Let’s prepare the help request.",
    blocks: [
      {
        type: "section",
        block_id: `${START_BLOCK_PREFIX}${area ?? "unselected"}`,
        text: {
          type: "mrkdwn",
          text: initialSummary
            ? "*A few final details*\nI’ll only ask for information that is still missing, then show the complete request for review."
            : "*New help request*\nI’ll ask for the required details one at a time.",
        },
      },
    ],
    metadata: {
      event_type: "help_request_conversation",
      event_payload: {
        ...(area && { area }),
        ...(initialSummary && { initial_summary: initialSummary }),
        ...(safeFollowUpAnswers.length === 0 &&
          initialDescription && {
            initial_description: initialDescription.slice(0, 1200),
          }),
        ...(safeFollowUpAnswers.length === 0 &&
          initialPrBuildUrl && {
            initial_pr_build_url: initialPrBuildUrl.slice(0, 350),
          }),
        ...(safeFollowUpAnswers.length === 0 &&
          initialAnalysis && {
            initial_analysis: initialAnalysis.slice(0, 350),
          }),
        ...(recommendedEnvironment && {
          initial_environment: recommendedEnvironment.value,
        }),
        ...(recommendedTeam && { initial_team: recommendedTeam.value }),
        ...(recommendedArea && { initial_area: recommendedArea.value }),
      },
    },
  });
  const rootTs = threadTs ?? startResponse.ts ?? startResponse.message?.ts;
  const draftState = {
    ...(area && {
      platformArea: optionsFor("platformArea").find(
        (option) => option.value === area,
      ),
    }),
    ...(initialSummary && { summary: initialSummary }),
    ...(initialDescription && { description: initialDescription }),
    ...(initialPrBuildUrl && { prBuildUrl: initialPrBuildUrl }),
    ...(initialAnalysis && { analysis: initialAnalysis }),
    ...(recommendedEnvironment && { environment: recommendedEnvironment }),
    ...(recommendedTeam && { team: recommendedTeam }),
    ...(recommendedArea && { area: recommendedArea }),
  };
  const firstStep = nextStep(draftState) ?? "confirmation";
  try {
    await postPrompt({
      client,
      channelId,
      threadTs: rootTs,
      step: firstStep,
      platformArea: area,
      state: draftState,
    });
  } catch (error) {
    console.error(
      "Could not render the interactive help request prompt; using typed replies",
      error,
    );
    await postFallbackPrompt({
      client,
      channelId,
      threadTs: rootTs,
      step: firstStep,
      platformArea: area,
      state: draftState,
    });
  }
  appInsights.trackEvent("Conversational help request started", {
    area: area ?? "unselected",
  });
}

async function handleConversationalHelpReply({ message, client, messages }) {
  const session = findActiveSession(messages);
  if (!session) return false;

  const threadTs = message.thread_ts ?? message.ts;
  const answer = messageText(message);
  if (!answer) return true;

  if (/^cancel$/i.test(answer)) {
    await postMarkedMessage({
      client,
      channelId: message.channel,
      threadTs,
      blockId: "help_request_conversation_cancelled",
      text: "No problem — I cancelled this help request and closed the thread. Start a new message whenever you need help.",
    });
    appInsights.trackEvent("Conversational help request cancelled", {
      area: session.platformArea,
    });
    return true;
  }

  const step = latestPromptStep(messages, session);
  const state = buildState(messages, session, message.ts);
  const platformArea = state.platformArea?.value ?? session.platformArea;
  if (!step) return false;

  if (step === "confirmation") {
    if (/^(yes|y|submit|confirm)$/i.test(answer)) {
      try {
        await client.assistant.threads.setStatus({
          channel_id: message.channel,
          thread_ts: threadTs,
          status: "Creating the help request…",
        });
        await submitConversationalHelpRequest({
          client,
          userId: message.user,
          channelId: message.channel,
          threadTs,
          platformArea,
          helpRequest: {
            ...state,
            user: message.user,
            followUpAnswers: session.followUpAnswers,
          },
        });
      } catch (error) {
        console.error("An error occurred when creating a help request", error);
        await postPrompt({
          client,
          channelId: message.channel,
          threadTs,
          step: "confirmation",
          platformArea,
          error:
            "I couldn't create the help request just now. Reply `yes` to retry or `cancel` to stop.",
          state,
        });
      }
      return true;
    }

    await postPrompt({
      client,
      channelId: message.channel,
      threadTs,
      step: "confirmation",
      platformArea,
      error:
        "Use the Edit buttons or dropdowns to change a field, then reply `yes` to submit or `cancel` to stop.",
      state,
    });
    return true;
  }

  const result = validateAnswer(step, answer, platformArea);
  if (result.error) {
    await postPrompt({
      client,
      channelId: message.channel,
      threadTs,
      step,
      platformArea,
      error: result.error,
    });
    return true;
  }

  state[step] = result.value;
  if (step === "platformArea") {
    delete state.environment;
    delete state.team;
    delete state.area;
  }
  const selectedPlatformArea =
    state.platformArea?.value ?? session.platformArea;
  appInsights.trackEvent("Conversational help request step completed", {
    area: selectedPlatformArea,
    step,
  });
  const followingStep = nextStep(state) ?? "confirmation";
  await postPrompt({
    client,
    channelId: message.channel,
    threadTs,
    step: followingStep,
    platformArea: selectedPlatformArea,
    state,
  });
  return true;
}

function actionAnswer(action) {
  if (action.action_id === "help_request_conversation_platform_crime") {
    return "Crime / CPP";
  }
  if (action.action_id === "help_request_conversation_platform_other") {
    return "Cloud Native / Other";
  }
  if (action.action_id.startsWith("help_request_conversation_skip_")) {
    return "skip";
  }
  if (action.action_id === "help_request_conversation_confirm") return "yes";
  if (action.action_id === "help_request_conversation_cancel") return "cancel";
  return action.selected_option?.text?.text ?? action.selected_option?.value;
}

function actionStep(actionId) {
  if (actionId.startsWith("help_request_conversation_platform_")) {
    return "platformArea";
  }
  if (actionId.startsWith("help_request_conversation_skip_")) {
    return actionId.slice("help_request_conversation_skip_".length);
  }
  if (actionId.startsWith("help_request_conversation_select_")) {
    return actionId.slice("help_request_conversation_select_".length);
  }
  if (
    actionId === "help_request_conversation_confirm" ||
    actionId === "help_request_conversation_cancel"
  ) {
    return "confirmation";
  }
  return undefined;
}

function nonInteractiveBlocks(blocks) {
  return blocks
    .filter((block) => block.type !== "actions")
    .map((block) => {
      if (!block.accessory) return block;
      const { accessory: _accessory, ...withoutAccessory } = block;
      return withoutAccessory;
    });
}

function inlineEditBlocks(blocks, field, initialValue) {
  const targetId = `help_request_conversation_review_${field === "prBuildUrl" ? "links" : field}`;
  const label = {
    summary: "Summary",
    description: "Description",
    prBuildUrl: "Links",
    analysis: "Already checked",
  }[field];
  const inputBlockId = `help_request_conversation_inline_${field}`;
  const inputActionId = `help_request_conversation_inline_value_${field}`;
  const result = [];

  for (const block of blocks) {
    if (block.block_id === targetId) {
      result.push(
        {
          type: "input",
          block_id: inputBlockId,
          optional: field === "prBuildUrl",
          label: { type: "plain_text", text: label },
          element: {
            type: "plain_text_input",
            action_id: inputActionId,
            initial_value: String(initialValue ?? "").slice(0, 2900),
            multiline: field !== "summary",
          },
        },
        {
          type: "actions",
          block_id: `help_request_conversation_inline_actions_${field}`,
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Save" },
              style: "primary",
              action_id: `help_request_conversation_inline_save_${field}`,
            },
            {
              type: "button",
              text: { type: "plain_text", text: "Cancel edit" },
              action_id: `help_request_conversation_inline_cancel_${field}`,
            },
          ],
        },
      );
      continue;
    }
    if (block.type === "actions") continue;
    if (!block.accessory) {
      result.push(block);
      continue;
    }
    const { accessory: _accessory, ...withoutAccessory } = block;
    result.push(withoutAccessory);
  }
  return result;
}

function inlineEditValue(body, field) {
  return body.state?.values?.[`help_request_conversation_inline_${field}`]?.[
    `help_request_conversation_inline_value_${field}`
  ]?.value;
}

async function recordActionAnswer({
  client,
  channelId,
  threadTs,
  step,
  answer,
}) {
  await client.chat.postMessage({
    channel: channelId,
    thread_ts: threadTs,
    text: `Selected: ${answer === "skip" ? "Skipped" : answer}`,
    blocks: [
      {
        type: "context",
        block_id: `${ANSWER_BLOCK_PREFIX}${step}`,
        elements: [
          {
            type: "mrkdwn",
            text: `*Selected:* ${answer === "skip" ? "Skipped" : answer}`,
          },
        ],
      },
    ],
    metadata: {
      event_type: "help_request_conversation_answer",
      event_payload: { step, answer },
    },
  });
}

async function handleConversationalHelpAction({ client, body, action }) {
  const channelId = body.channel.id;
  const threadTs = body.message.thread_ts ?? body.message.ts;
  const history = await client.conversations.replies({
    channel: channelId,
    ts: threadTs,
    limit: 200,
    include_all_metadata: true,
  });
  const historyMessages = history.messages ?? [];
  const messages = historyMessages.some(
    (message) => message.ts === body.message.ts,
  )
    ? historyMessages
    : [...historyMessages, body.message];
  const session = findActiveSession(messages);
  if (!session) return false;

  const step = latestPromptStep(messages, session);
  const editPrefix = "help_request_conversation_edit_";
  const inlineSavePrefix = "help_request_conversation_inline_save_";
  const inlineCancelPrefix = "help_request_conversation_inline_cancel_";
  const reviewSelectPrefix = "help_request_conversation_review_select_";
  if (step === "confirmation" && action.action_id.startsWith(editPrefix)) {
    const editStep = action.action_id.slice(editPrefix.length);
    const state = buildState(messages, session);
    await client.chat.update({
      channel: channelId,
      ts: body.message.ts,
      text: body.message.text,
      blocks: inlineEditBlocks(body.message.blocks, editStep, state[editStep]),
      metadata: reviewStateMetadata(state),
    });
    return true;
  }

  if (
    step === "confirmation" &&
    (action.action_id.startsWith(inlineSavePrefix) ||
      action.action_id.startsWith(inlineCancelPrefix))
  ) {
    const saving = action.action_id.startsWith(inlineSavePrefix);
    const prefix = saving ? inlineSavePrefix : inlineCancelPrefix;
    const editStep = action.action_id.slice(prefix.length);
    const state = buildState(messages, session);
    const platformArea = state.platformArea?.value ?? session.platformArea;
    if (saving) {
      const answer = inlineEditValue(body, editStep) ?? "";
      const result = validateAnswer(editStep, answer, platformArea);
      if (result.error) return false;
      state[editStep] = result.value;
    }
    await postPrompt({
      client,
      channelId,
      threadTs,
      step: "confirmation",
      platformArea,
      state,
      updateTs: body.message.ts,
    });
    return true;
  }

  if (
    step === "confirmation" &&
    action.action_id.startsWith(reviewSelectPrefix)
  ) {
    const selectedStep = action.action_id.slice(reviewSelectPrefix.length);
    const answer = actionAnswer(action);
    const state = buildState(messages, session);
    const platformArea = state.platformArea?.value ?? session.platformArea;
    const result = validateAnswer(selectedStep, answer ?? "", platformArea);
    if (result.error) return false;
    state[selectedStep] = result.value;
    if (selectedStep === "platformArea") {
      delete state.environment;
      delete state.team;
      delete state.area;
    }

    const followingStep = nextStep(state);
    if (followingStep) {
      await client.chat.update({
        channel: channelId,
        ts: body.message.ts,
        text: body.message.text,
        blocks: nonInteractiveBlocks(body.message.blocks),
      });
      await recordActionAnswer({
        client,
        channelId,
        threadTs,
        step: selectedStep,
        answer,
      });
      await postPrompt({
        client,
        channelId,
        threadTs,
        step: followingStep,
        platformArea: state.platformArea?.value ?? platformArea,
        state,
      });
    } else {
      await postPrompt({
        client,
        channelId,
        threadTs,
        step: "confirmation",
        platformArea: state.platformArea?.value ?? platformArea,
        state,
        updateTs: body.message.ts,
      });
    }
    return true;
  }

  const answer = actionAnswer(action);
  if (!step || step !== actionStep(action.action_id) || !answer) return false;

  await client.chat.update({
    channel: channelId,
    ts: body.message.ts,
    text: body.message.text,
    blocks: nonInteractiveBlocks(body.message.blocks),
  });

  await recordActionAnswer({
    client,
    channelId,
    threadTs,
    step,
    answer,
  });

  const syntheticMessage = {
    type: "message",
    channel: channelId,
    channel_type: "im",
    thread_ts: threadTs,
    ts: body.action_ts ?? `${Date.now() / 1000}`,
    user: body.user.id,
    text: answer,
  };
  return handleConversationalHelpReply({
    message: syntheticMessage,
    client,
    messages: [...messages, syntheticMessage],
  });
}

module.exports.startConversationalHelpRequest = startConversationalHelpRequest;
module.exports.handleConversationalHelpReply = handleConversationalHelpReply;
module.exports.handleConversationalHelpAction = handleConversationalHelpAction;
module.exports.findActiveSession = findActiveSession;
module.exports.buildState = buildState;
module.exports.validateAnswer = validateAnswer;
