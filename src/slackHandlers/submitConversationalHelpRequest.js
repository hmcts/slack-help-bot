const {
  helpRequestMainBlocks,
  helpRequestDetailBlocks,
} = require("../messages");
const {
  createHelpRequest,
  updateHelpRequestDescription,
} = require("../service/persistence");
const { lookupUsersEmail } = require("./utils/lookupUser");
const { createHelpRequestInCosmos } = require("../service/cosmos");
const { convertJiraKeyToUrl } = require("../messages/util");
const { checkSlackResponseError } = require("./errorHandling");
const { uuidv7 } = require("uuidv7");
const config = require("config");
const appInsights = require("../modules/appInsights");

const reportChannelId = config.get("slack.report_channel_id");
const reportChannelCrimeId = config.get("slack.report_channel_crime_id");

function cleanLabel(label) {
  return label.replace(" ", "-").toLowerCase();
}

async function submitConversationalHelpRequest({
  client,
  userId,
  channelId,
  threadTs,
  platformArea,
  helpRequest,
}) {
  const userEmail = await lookupUsersEmail({ user: userId, client });
  const jiraId = await createHelpRequest({
    summary: helpRequest.summary,
    userEmail,
    labels: [
      cleanLabel(`area-${helpRequest.area.value}`),
      cleanLabel(`team-${helpRequest.team.value}`),
      platformArea === "crime"
        ? "platform-area-crime"
        : "platform-area-non-crime",
    ],
  });

  const reportChannel =
    platformArea === "crime" ? reportChannelCrimeId : reportChannelId;
  const mainRes = await client.chat.postMessage({
    channel: reportChannel,
    text: "New platform help request raised",
    blocks: helpRequestMainBlocks({
      ...helpRequest,
      user: userId,
      jiraId,
      area: platformArea,
    }),
  });
  checkSlackResponseError(
    mainRes,
    "An error occurred when posting a help request to Slack",
  );

  const detailsRes = await client.chat.postMessage({
    channel: reportChannel,
    thread_ts: mainRes.message.ts,
    text: "Help request details",
    blocks: helpRequestDetailBlocks(helpRequest),
  });
  checkSlackResponseError(
    detailsRes,
    "An error occurred when posting details of a help request to Slack",
  );

  const permalink = (
    await client.chat.getPermalink({
      channel: mainRes.channel,
      message_ts: mainRes.message.ts,
    })
  ).permalink;

  await updateHelpRequestDescription(jiraId, {
    ...helpRequest,
    slackLink: permalink,
  });

  await client.chat.postMessage({
    channel: channelId,
    thread_ts: threadTs,
    text: `Created <${convertJiraKeyToUrl(jiraId)}|${jiraId}>. Continue in the <${permalink}|Platform Operations thread>. This conversation is now closed.`,
    blocks: [
      {
        type: "section",
        block_id: "help_request_conversation_complete",
        text: {
          type: "mrkdwn",
          text: `Created <${convertJiraKeyToUrl(jiraId)}|${jiraId}>. Continue in the <${permalink}|Platform Operations thread>. This conversation is now closed.`,
        },
      },
    ],
  });

  try {
    await createHelpRequestInCosmos({
      id: uuidv7(),
      created_at: new Date(),
      key: jiraId,
      status: "Open",
      area: platformArea,
      title: helpRequest.summary,
      description: helpRequest.description,
      analysis: helpRequest.analysis,
      url: permalink,
    });
  } catch (error) {
    console.error(
      "Help request was created but could not be recorded in Cosmos",
      error,
    );
  }

  appInsights.trackEvent("Submitted help request", { key: jiraId });
  return { jiraId, permalink };
}

module.exports.submitConversationalHelpRequest =
  submitConversationalHelpRequest;
