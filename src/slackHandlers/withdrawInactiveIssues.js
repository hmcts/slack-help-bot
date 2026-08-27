const {
  searchForInactiveIssues,
  addInactivityNotificationLabel,
  addWithdrawnLabel,
  withdrawIssue,
  getUserByKey,
  INACTIVITY_STAGES,
} = require("../service/persistence");
const config = require("config");
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

const firstReminderMs = Number(config.get("inactivity.first_reminder_ms"));
const secondReminderMs = Number(config.get("inactivity.second_reminder_ms"));
const withdrawalMs = Number(config.get("inactivity.withdrawal_ms"));
const testIssueKey = process.env.JIRA_TEST_ISSUE_KEY;
const debugInactive = (...args) => {
  if (testIssueKey) console.log("[inactivity-debug]", ...args);
};

const formatDuration = (durationMs) => {
  const minutes = Math.round(durationMs / 60000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const days = Math.round(minutes / 1440);
  return `${days} day${days === 1 ? "" : "s"}`;
};

const sendSlackMessage = async (
  app,
  channel,
  jiraIssue,
  thread,
  reminderMs,
) => {
  let message;
  if (reminderMs !== undefined) {
    const remainingMs = withdrawalMs - reminderMs;
    message = `Hi there! Issue ${jiraIssue} has been inactive for ${formatDuration(reminderMs)}. Please add an update if you still require help. If there is no activity, this issue will be withdrawn in ${formatDuration(remainingMs)}.`;
  } else if (thread === undefined) {
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
    return false;
  }
  return true;
};

const notifyInactiveIssue = async (app, issue, reminderMs) => {
  const reporter = await getUserByKey(issue.fields.reporter.key);
  const slackUserInfo = await getSlackUserInfo(app, reporter.emailAddress);
  const description = issue.fields.description;
  const urlMatch = description.match(
    /https:\/\/[\w.-]+\/[\w.-]+\/[\w.-]+\/[\w.-]+\?[\w=&.-]+/,
  );

  if (urlMatch) {
    const urlString = urlMatch[0];
    const url = new URL(urlString);
    const dmSent = await sendSlackMessage(
      app,
      slackUserInfo.user.id,
      issue.key,
      urlString,
      reminderMs,
    );
    const threadSent = await commentOnSlackThread(
      app,
      url.searchParams.get("cid"),
      url.searchParams.get("thread_ts"),
      reminderMs,
    );
    return dmSent && threadSent;
  } else {
    return await sendSlackMessage(
      app,
      slackUserInfo.user.id,
      issue.key,
      undefined,
      reminderMs,
    );
  }
};

const notifyInactiveIssues = async (app, days) => {
  const isFirstWarning = days === INACTIVITY_STAGES.FIRST_WARNING;
  const notificationLabel = `inactivity-notified-${
    isFirstWarning ? "first-warning" : "second-warning"
  }`;
  const reminderMs = isFirstWarning ? firstReminderMs : secondReminderMs;
  const results = await searchForInactiveIssues(days, notificationLabel);
  debugInactive("notify stage", {
    stage: days,
    notificationLabel,
    reminderMs,
    issueCount: results.issues.length,
  });

  for (const issue of results.issues) {
    try {
      if (!issue.fields.description) {
        debugInactive("skipping notification; description is empty", issue.key);
        continue;
      }
      if (await notifyInactiveIssue(app, issue, reminderMs)) {
        debugInactive("notification sent; adding label", issue.key);
        await addInactivityNotificationLabel(
          issue.key,
          `${notificationLabel}-${Date.now()}`,
          issue.fields.labels || [],
        );
      } else {
        debugInactive(
          "notification not fully sent; label not added",
          issue.key,
        );
      }
    } catch (err) {
      console.error(`Error notifying issue ${issue.key}`, err);
    }
  }
};

const commentOnSlackThread = async (app, channel, timestamp, reminderMs) => {
  try {
    await app.client.chat.postMessage({
      channel: channel,
      thread_ts: timestamp,
      text:
        reminderMs === undefined
          ? "This issue has been withdrawn due to inactivity. You can re-open the issue at anytime from this thread."
          : `This issue has been inactive for ${formatDuration(reminderMs)}. Please add an update if you still require help.`,
    });
  } catch (error) {
    console.error(`Error replying to Slack thread ${channel}`, error);
    return false;
  }
  return true;
};

const withdrawInactiveIssues = async (app) => {
  const results = await searchForInactiveIssues(INACTIVITY_STAGES.WITHDRAWAL);
  debugInactive("withdraw stage", {
    issueCount: results.issues.length,
    issues: results.issues.map((issue) => issue.key),
  });

  // Loop through inactive issues
  if (results.issues.length > 0) {
    for (const issue of results.issues) {
      const issueId = issue.key;

      try {
        // Transition first; only label successfully withdrawn issues.
        debugInactive("withdrawing", issueId);
        console.log(`Withdrawing issue ${issueId}...`);
        await withdrawIssue(issueId);
        debugInactive("transition succeeded; adding withdrawn label", issueId);
        await addWithdrawnLabel(issueId);
        console.log(`Issue ${issueId} withdrawn`);
      } catch (err) {
        debugInactive("withdrawal failed", issueId, err.message);
        console.error(
          `Error transitioning issue ${issueId}; it will be retried`,
          err,
        );
        continue;
      }

      try {
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
        } else {
          await sendSlackMessage(app, slackUserId, issueId);
        }
      } catch (err) {
        console.error(
          `Error notifying reporter of withdrawn issue ${issueId}`,
          err,
        );
      }
    }
  } else {
    console.log("No issues to withdraw");
  }
};

module.exports.withdrawInactiveIssues = withdrawInactiveIssues;
module.exports.notifyInactiveIssues = notifyInactiveIssues;
module.exports.INACTIVITY_STAGES = INACTIVITY_STAGES;
