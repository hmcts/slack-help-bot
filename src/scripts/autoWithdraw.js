const config = require("@hmcts/properties-volume").addTo(require("config"));
const setupSecrets = require("../setupSecrets");
setupSecrets.setup();

const {
  searchForInactiveIssues,
  withdrawIssue,
  addWithdrawnLabel,
  getUserByKey,
} = require("../service/persistence");

const slackBotToken = config.get("slack.bot_token");
const slackApiUrl = "https://slack.com/api/";

const getSlackUserInfo = async (userEmail) => {
  try {
    const response = await fetch(
      `${slackApiUrl}users.lookupByEmail?email=${userEmail}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${slackBotToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(
      `Error fetching user info for user ${userEmail} from Slack`,
      error,
    );
  }
};

const sendSlackMessage = async (channel, jiraIssue, thread) => {
  let message;
  if (thread === undefined) {
    message = `Hi there! Issue ${jiraIssue} has been withdrawn due to inactivity. If you require this issue to be re-opened, please contact PlatOps.`;
  } else {
    message = `Hi there! Issue ${jiraIssue} has been withdrawn due to inactivity. If you require this issue to be re-opened, you can do so from this thread - ${thread}.`;
  }

  try {
    const response = await fetch(`${slackApiUrl}chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${slackBotToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: channel,
        text: message,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error(`Error sending message to user ${channel}`, error);
  }
};

const commentOnSlackThread = async (channel, timestamp) => {
  try {
    const response = await fetch(`${slackApiUrl}chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${slackBotToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: channel,
        thread_ts: timestamp,
        text: "This issue has been withdrawn due to inactivity. You can re-open the issue at anytime from this thread.",
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error(`Error replying to Slack thread ${channel}`, error);
  }
};

const setRequestStatusSlack = async (channel, timestamp) => {
  try {
    const response = await fetch(
      `${slackApiUrl}conversations.replies?channel=${channel}&ts=${timestamp}&limit=200`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${slackBotToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    const helpRequestMessages = data.messages;
    const blocks = helpRequestMessages[0].blocks;

    blocks[6].elements[2] = {
      type: "button",
      text: {
        type: "plain_text",
        text: ":snow_cloud: Re-open",
        emoji: true,
      },
      style: "primary",
      value: "start_help_request",
      action_id: "start_help_request",
    };

    blocks[2].fields[0].text = "Status :snowflake:\n Done";

    await fetch(`${slackApiUrl}chat.update`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${slackBotToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: channel,
        ts: timestamp,
        text: "New platform help request raised",
        blocks: blocks,
      }),
    });
  } catch (error) {
    console.error(`Error setting status in Slack thread ${channel}`, error);
  }
};

const withdrawInactiveIssues = async () => {
  const results = await searchForInactiveIssues();

  // Loop through inactive issues
  if (results.issues.length > 0) {
    for (const issue of results.issues) {
      const issueId = issue["key"];

      // Withdraw issue and add withdrawn label in Jira
      console.log(`Withdrawing issue ${issueId}...`);
      await addWithdrawnLabel(issueId);
      await withdrawIssue(issueId);
      console.log(`Issue ${issueId} withdrawn`);

      const reporterKey = issue["fields"]["reporter"]["key"];
      const reporter = await getUserByKey(reporterKey);
      const reporterEmail = reporter["emailAddress"];

      const slackUserInfo = await getSlackUserInfo(reporterEmail);
      const slackUserId = slackUserInfo["user"]["id"];

      const description = issue["fields"]["description"];
      const urlMatch = description.match(
        /https:\/\/[\w.-]+\/[\w.-]+\/[\w.-]+\/[\w.-]+\?[\w=&.-]+/,
      );

      // If the issue was created from Slack, send dm to reporter and comment on the thread
      // Otherwise, just send dm to reporter
      if (urlMatch) {
        const urlString = urlMatch[0];
        const url = new URL(urlString);
        const thread_ts = url.searchParams.get("thread_ts");
        const cid = url.searchParams.get("cid");

        console.log(`Sending message to user ${slackUserId}...`);
        await sendSlackMessage(slackUserId, issueId, urlString);
        console.log(`Message sent to user ${slackUserId}`);

        console.log(`Commenting on Slack thread ${cid}...`);
        await commentOnSlackThread(cid, thread_ts);
        console.log(`Commented on Slack thread ${cid}`);

        console.log(`Setting status in Slack thread ${cid}...`);
        await setRequestStatusSlack(cid, thread_ts);
        console.log(`Status set in Slack thread ${cid}`);
      } else {
        console.log(`Sending message to user ${slackUserId}...`);
        await sendSlackMessage(slackUserId, issueId);
        console.log(`Message sent to user ${slackUserId}`);
      }
    }
  } else {
    console.log("No issues to withdraw");
  }
};

withdrawInactiveIssues();
