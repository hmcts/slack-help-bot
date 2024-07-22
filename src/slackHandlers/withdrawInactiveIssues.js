const {
  searchForInactiveIssues,
  addWithdrawnLabel,
  withdrawIssue,
  getUserByKey,
} = require("../service/persistence");
const getSlackUserInfo = async (app, userEmail) => {
  try {
    return await app.client.users.lookupByEmail({
      email: userEmail,
    });
  } catch (error) {
    console.error(
      `Error fetching user info for user ${userEmail} from Slack`,
      error,
    );
  }
};

const sendSlackMessage = async (app, channel, jiraIssue, thread) => {
  let message;
  if (thread === undefined) {
    message = `Hi there! Issue ${jiraIssue} has been withdrawn due to inactivity. If you require this issue to be re-opened, please contact Platform Operations.`;
  } else {
    message = `Hi there! Issue ${jiraIssue} has been withdrawn due to inactivity. If you require this issue to be re-opened, you can do so from this thread - ${thread}.`;
  }

  try {
    await app.client.chat.postMessage({
      channel: channel,
      text: message,
    });
  } catch (error) {
    console.error(`Error sending message to user ${channel}`, error);
  }
};

const commentOnSlackThread = async (app, channel, timestamp) => {
  try {
    await app.client.chat.postMessage({
      channel: channel,
      thread_ts: timestamp,
      text: "This issue has been withdrawn due to inactivity. You can re-open the issue at anytime from this thread.",
    });
  } catch (error) {
    console.error(`Error replying to Slack thread ${channel}`, error);
  }
};

const setRequestStatusSlack = async (app, channel, timestamp) => {
  try {
    const messages = (
      await app.client.conversations.replies({
        channel: channel,
        ts: timestamp,
        limit: 200,
      })
    ).messages;

    const blocks = messages[0].blocks;

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

    await app.client.chat.update({
      channel: channel,
      ts: timestamp,
      text: "New platform help request raised",
      blocks: blocks,
    });
  } catch (error) {
    console.error(`Error setting status in Slack thread ${channel}`, error);
  }
};

const withdrawInactiveIssues = async (app) => {
  const results = await searchForInactiveIssues();

  // Loop through inactive issues
  if (results.issues.length > 0) {
    for (const issue of results.issues) {
      const issueId = issue.key;
      try {
        // Withdraw issue and add withdrawn label in Jira
        console.log(`Withdrawing issue ${issueId}...`);
        await addWithdrawnLabel(issueId);
        await withdrawIssue(issueId);
        console.log(`Issue ${issueId} withdrawn`);

        const reporterKey = issue.fields.reporter.key;
        const reporter = await getUserByKey(reporterKey);
        const reporterEmail = reporter.emailAddress;

        const slackUserInfo = await getSlackUserInfo(app, reporterEmail);
        const slackUserId = slackUserInfo.user.id;

        const description = issue.fields.description;
        const urlMatch = description.match(
          /https:\/\/[\w.-]+\/[\w.-]+\/[\w.-]+\/[\w.-]+\?[\w=&.-]+/,
        );

        // If the issue was created from Slack, send dm to reporter and comment on the thread
        // Otherwise, just send dm to reporter
        if (urlMatch) {
          const urlString = urlMatch[0];
          const url = new URL(urlString);
          const threadTs = url.searchParams.get("thread_ts");
          const cid = url.searchParams.get("cid");

          await sendSlackMessage(app, slackUserId, issueId, urlString);

          await commentOnSlackThread(app, cid, threadTs);

          await setRequestStatusSlack(app, cid, threadTs);
        } else {
          await sendSlackMessage(app, slackUserId, issueId);
        }
      } catch (err) {
        console.error(`Error withdrawing issue ${issueId}`, err);
      }
    }
  } else {
    console.log("No issues to withdraw");
  }
};

module.exports.withdrawInactiveIssues = withdrawInactiveIssues;
