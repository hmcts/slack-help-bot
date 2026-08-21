const JiraApi = require("jira-client");
const config = require("config");
const {
  createComment,
  mapFieldsToDescription,
  createResolveComment,
} = require("./jiraMessages");

const systemUser = config.get("jira.username");

const issueTypeId = config.get("jira.issue_type_id");
const issueTypeName = config.get("jira.issue_type_name");
const supportIssueTypeId =
  config.get("jira.support_issue_type_id") || issueTypeId;
const taskIssueTypeId = config.get("jira.task_issue_type_id");

/** @type {string} */
const jiraProject = config.get("jira.project");

const jiraStartTransitionId = config.get("jira.start_transition_id");
const jiraWithdrawnTransitionId = config.get("jira.withdrawn_transition_id");
const jiraDoneTransitionId = config.get("jira.done_transition_id");
const firstReminderMs = Number(config.get("inactivity.first_reminder_ms"));
const secondReminderMs = Number(config.get("inactivity.second_reminder_ms"));
const withdrawalMs = Number(config.get("inactivity.withdrawal_ms"));
const extractProjectRegex = new RegExp(`(${jiraProject}-\\d+)`);

const jira = new JiraApi({
  protocol: "https",
  host: "tools.hmcts.net/jira",
  bearer: config.get("jira.api_token"),
  apiVersion: "2",
  strictSSL: true,
});

/**
 * Extracts a jira ID
 *
 * expected format: 'View on Jira: <https://tools.hmcts.net/jira/browse/SBOX-61|SBOX-61>'
 * @param blocks
 */
function extractJiraIdFromBlocks(blocks) {
  let viewOnJiraText;
  if (blocks.length === 3) {
    viewOnJiraText = blocks[2].fields[0].text;
  } else {
    viewOnJiraText = blocks[4].elements[0].text;
  }

  const project = extractProjectRegex.exec(viewOnJiraText);

  return project ? project[1] : "undefined";
}

function extraJiraId(text) {
  return extractProjectRegex.exec(text)[1];
}

/**
 * @param {string} email
 */
async function convertEmail(email) {
  if (!email) {
    return systemUser;
  }

  try {
    // noinspection JSCheckFunctionSignatures - types are wrong, it may be deprecated, but I can't make the new param work
    const res = await jira.searchUsers({
      username: email,
      maxResults: 1,
    });

    if (!res || res.length === 0) {
      console.log("Failed to find user in Jira with email", email);
      return undefined;
    }

    return res[0].name;
  } catch (ex) {
    console.log("Querying username failed", ex);
    return systemUser;
  }
}

async function resolveHelpRequest(jiraId) {
  try {
    await jira.transitionIssue(jiraId, {
      transition: {
        id: jiraDoneTransitionId,
      },
    });
  } catch (err) {
    console.log("Error resolving help request in jira", err);
  }
}

async function markAsDuplicate(jiraIdToUpdate, parentJiraId) {
  try {
    await jira.issueLink({
      type: {
        name: "Duplicate",
      },
      inwardIssue: {
        key: jiraIdToUpdate,
      },
      outwardIssue: {
        key: parentJiraId,
      },
    });

    await jira.transitionIssue(jiraIdToUpdate, {
      transition: {
        id: jiraDoneTransitionId,
      },
    });
  } catch (err) {
    console.log("Error marking help request as duplicate in jira", err);
  }
}

async function updateHelpRequestType(jiraId, ticketType) {
  const issueTypeId =
    ticketType === "task" ? taskIssueTypeId : supportIssueTypeId;
  const ticketTypeLabel = `ticket-type-${ticketType}`;

  if (!issueTypeId) {
    throw new Error(`No Jira issue type configured for ${ticketType}`);
  }

  await jira.updateIssue(jiraId, {
    fields: {
      issuetype: {
        id: issueTypeId,
      },
    },
    update: {
      labels: [
        { remove: "ticket-type-support" },
        { remove: "ticket-type-task" },
        { add: ticketTypeLabel },
      ],
    },
  });
}

async function startHelpRequest(jiraId) {
  try {
    await jira.transitionIssue(jiraId, {
      transition: {
        id: jiraStartTransitionId,
      },
    });
  } catch (err) {
    console.log("Error starting help request in jira", err);
  }
}

async function getIssueDescription(issueId) {
  try {
    const issue = await jira.getIssue(issueId, "description");
    return issue.fields.description;
  } catch (err) {
    if (err.statusCode === 404) {
      return undefined;
    } else if (err.message.includes("The issue no longer exists")) {
      return undefined;
    } else {
      throw err;
    }
  }
}

async function searchForUnassignedOpenIssues() {
  const jqlQuery = `project = ${jiraProject} AND type = "${issueTypeName}" AND status IN ("Open", "To Do") AND assignee IS EMPTY AND labels NOT IN ("Heritage") ORDER BY created ASC`;
  try {
    return await jira.searchJira(jqlQuery, {
      // TODO if we moved the slack link out to another field we wouldn't need to request the whole description
      // which would probably be better for performance
      fields: [
        "created",
        "description",
        "summary",
        "updated",
        "status",
        "reporter",
      ],
    });
  } catch (err) {
    console.log("Error searching for issues in jira", err);
    return {
      issues: [],
    };
  }
}

async function searchForOpenIssues() {
  const jqlQuery = `project = ${jiraProject} AND type = "${issueTypeName}" AND status IN ("Open", "In Progress") AND labels NOT IN ("Heritage") ORDER BY created ASC`;
  try {
    return await jira.searchJira(jqlQuery, {
      fields: [
        "created",
        "description",
        "summary",
        "updated",
        "status",
        "assignee",
      ],
    });
  } catch (err) {
    console.log("Error searching for issues in jira", err);
    return {
      issues: [],
    };
  }
}

async function searchForIssuesAssignedTo(userEmail) {
  const user = await convertEmail(await userEmail);
  const jqlQuery = `project = ${jiraProject} AND type = "${issueTypeName}" AND assignee = "${user}" AND status IN ("Open", "In Progress") AND labels NOT IN ("Heritage") ORDER BY created ASC`;
  try {
    return await jira.searchJira(jqlQuery, {
      fields: [
        "created",
        "description",
        "summary",
        "updated",
        "status",
        "reporter",
      ],
    });
  } catch (err) {
    console.log("Error searching for issues in jira", err);
    return {
      issues: [],
    };
  }
}

async function searchForIssuesRaisedBy(userEmail) {
  const user = await convertEmail(await userEmail);
  const jqlQuery = `project = ${jiraProject} AND type = "${issueTypeName}" AND reporter = "${user}" AND status IN ("Open", "In Progress") AND labels NOT IN ("Heritage") ORDER BY created ASC`;
  try {
    return await jira.searchJira(jqlQuery, {
      fields: [
        "created",
        "description",
        "summary",
        "updated",
        "status",
        "assignee",
      ],
    });
  } catch (err) {
    console.log("Error searching for issues in jira", err);
    return {
      issues: [],
    };
  }
}

async function search(jqlQuery, startAt, fields) {
  try {
    return await jira.searchJira(jqlQuery, {
      fields: fields,
      maxResults: 750,
      startAt,
    });
  } catch (err) {
    console.log("Error searching for issues in jira", err);
    return {
      issues: [],
    };
  }
}

async function assignHelpRequest(issueId, email) {
  /** @type {string} */
  const user = await convertEmail(email);

  try {
    await jira.updateAssignee(issueId, user);
  } catch (err) {
    console.log("Error assigning help request in jira", issueId, err);
  }
}

async function createHelpRequestInJira(
  summary,
  project,
  user,
  labels,
  issueType = "support",
) {
  const selectedIssueTypeId =
    issueType === "task" ? taskIssueTypeId : supportIssueTypeId;

  if (!selectedIssueTypeId) {
    throw new Error(`No Jira issue type configured for ${issueType}`);
  }

  console.log(`Creating help request in Jira for user: ${user}`);
  return await jira.addNewIssue({
    fields: {
      summary: summary,
      issuetype: {
        id: selectedIssueTypeId,
      },
      project: {
        id: project.id,
      },
      labels: ["created-from-slack", ...labels],
      description: undefined,
      reporter: {
        name: user, // API docs say ID, but our jira version doesn't have that field yet, may need to change in future
      },
    },
  });
}

async function createHelpRequest({
  summary,
  userEmail,
  labels,
  issueType = "support",
}) {
  const user = await convertEmail(userEmail);

  const project = await jira.getProject(jiraProject);

  // https://developer.atlassian.com/cloud/jira/platform/rest/v2/api-group-issues/#api-rest-api-2-issue-post
  // note: fields don't match 100%, our Jira version is a bit old (still a supported LTS though)

  let result;
  try {
    result = await createHelpRequestInJira(
      summary,
      project,
      user,
      labels,
      issueType,
    );
  } catch (err) {
    // in case the user doesn't exist in Jira use the system user
    result = await createHelpRequestInJira(
      summary,
      project,
      systemUser,
      labels,
      issueType,
    );

    if (!result.key) {
      console.log(
        "Error creating help request in jira",
        JSON.stringify(result),
      );
    }
  }

  return result.key;
}

async function updateHelpRequestDescription(issueId, fields) {
  const jiraDescription = mapFieldsToDescription(fields);
  try {
    await jira.updateIssue(issueId, {
      update: {
        description: [
          {
            set: jiraDescription,
          },
        ],
      },
    });
  } catch (err) {
    console.log("Error updating help request description in jira", err);
  }
}

async function addCommentToHelpRequest(externalSystemId, fields) {
  try {
    await jira.addComment(externalSystemId, createComment(fields));
  } catch (err) {
    console.log("Error creating comment in jira", externalSystemId, err);
  }
}

async function addCommentToHelpRequestResolve(
  externalSystemId,
  { category, how },
) {
  try {
    await jira.addComment(
      externalSystemId,
      createResolveComment({ category, how }),
    );
  } catch (err) {
    console.log("Error creating comment in jira", externalSystemId, err);
  }
}

async function addLabel(externalSystemId, { category }) {
  try {
    await jira.updateIssue(externalSystemId, {
      update: {
        labels: [
          {
            add: `resolution-${category.toLowerCase().replaceAll(" ", "-")}`,
          },
        ],
      },
    });
  } catch (err) {
    console.log(
      "Error updating help request description in jira",
      externalSystemId,
      err,
    );
  }
}

const withdrawFailedLabel = "auto-withdraw-failed";
const INACTIVITY_STAGES = Object.freeze({
  FIRST_WARNING: "first-warning",
  SECOND_WARNING: "second-warning",
  WITHDRAWAL: "withdrawal",
});
// Local-only override for testing the notify/withdraw process end-to-end against
// one known issue instead of whatever currently matches the real inactivity criteria
const testIssueKey = process.env.JIRA_TEST_ISSUE_KEY;

async function searchForInactiveIssues(days, notificationLabel) {
  let jqlQuery;
  if (testIssueKey) {
    jqlQuery = `key = "${testIssueKey}"`;
  } else {
    const excludedLabels = [withdrawFailedLabel];
    const labelFilter = ` AND (labels IS EMPTY OR labels NOT IN (${excludedLabels
      .map((label) => `"${label}"`)
      .join(", ")}))`;
    jqlQuery = `project = ${jiraProject} AND type = "${issueTypeName}" AND status IN ("In Progress")${labelFilter}`;
  }
  try {
    const results = await jira.searchJira(jqlQuery, {
      fields: [
        "created",
        "description",
        "summary",
        "updated",
        "status",
        "reporter",
        "labels",
      ],
    });


    const now = Date.now();
    const firstToSecondMs = secondReminderMs - firstReminderMs;
    const secondToWithdrawalMs = withdrawalMs - secondReminderMs;
    const prefix = notificationLabel;
    results.issues = results.issues.filter((issue) => {
      const labels = issue.fields.labels || [];
      if (labels.includes(withdrawFailedLabel)) return false;

      const updatedAt = new Date(issue.fields.updated).getTime();
      const age = now - updatedAt;
      const hasLabel = (labelPrefix) =>
        labels.some(
          (label) =>
            label === labelPrefix || label.startsWith(`${labelPrefix}-`),
        );
      const getLabelTime = (labelPrefix) => {
        const label = labels.find((item) =>
          item.startsWith(`${labelPrefix}-`),
        );
        if (!label) return undefined;
        const value = Number(label.slice(labelPrefix.length + 1));
        return Number.isFinite(value) ? value : undefined;
      };
      const currentNotifiedAt = prefix ? getLabelTime(prefix) : undefined;
      const currentLabelActive =
        (prefix && labels.includes(prefix)) ||
        (currentNotifiedAt !== undefined &&
          updatedAt <= currentNotifiedAt + 5 * 60 * 1000);

      if (days === INACTIVITY_STAGES.FIRST_WARNING) {
        return (
          !currentLabelActive &&
          age >= firstReminderMs &&
          age < secondReminderMs
        );
      }

      const previousPrefix = days === INACTIVITY_STAGES.SECOND_WARNING
        ? "inactivity-notified-first-warning-"
        : "inactivity-notified-second-warning-";
      const previousLabelTime = getLabelTime(previousPrefix);
      const previousLabelActive =
        previousLabelTime !== undefined &&
        updatedAt <= previousLabelTime + 5 * 60 * 1000;
      const notifiedAt = previousLabelActive ? previousLabelTime : undefined;
      const baselineAge = notifiedAt === undefined ? age : now - notifiedAt;
      const unchangedSinceNotification =
        notifiedAt === undefined || updatedAt <= notifiedAt + 5 * 60 * 1000;

      if (days === INACTIVITY_STAGES.SECOND_WARNING) {
        // If the first reminder label is missing, use the issue age directly.
        return (
          !currentLabelActive &&
          unchangedSinceNotification &&
          ((notifiedAt !== undefined &&
            baselineAge >= firstToSecondMs &&
            baselineAge < withdrawalMs - firstReminderMs) ||
            (notifiedAt === undefined &&
              age >= secondReminderMs &&
              age < withdrawalMs))
        );
      }

      // Reminder labels are useful anchors when a cron run was missed, but
      // they must not be required for the withdrawal stage. Fall back to the
      // issue's current age when no prior reminder label exists.
      return (
        unchangedSinceNotification &&
        ((notifiedAt !== undefined && baselineAge >= secondToWithdrawalMs) ||
          (notifiedAt === undefined && age >= withdrawalMs))
      );
    });
    return results;
  } catch (err) {
    console.log("Error searching for issues in jira", err);
    return {
      issues: [],
    };
  }
}

async function addInactivityNotificationLabel(issueId, label) {
  try {
    await jira.updateIssue(issueId, {
      update: {
        labels: [
          {
            add: label,
          },
        ],
      },
    });
    return true;
  } catch (err) {
    console.log(`Error adding label to issue ${issueId} in jira`, err);
    return false;
  }
}

async function addWithdrawnLabel(issueId) {
  try {
    await jira.updateIssue(issueId, {
      update: {
        labels: [
          {
            add: "auto-withdrawn",
          },
        ],
      },
    });
  } catch (err) {
    console.log(`Error adding label to issue ${issueId} in jira`, err);
  }
}

async function removeWithdrawnLabel(issueId) {
  try {
    await jira.updateIssue(issueId, {
      update: {
        labels: [
          {
            remove: "auto-withdrawn",
          },
        ],
      },
    });
  } catch (err) {
    console.log(`Error removing label from issue ${issueId} in jira`, err);
  }
}

async function withdrawIssue(issueId) {
  console.log(`Withdrawing issue ${issueId}...`, jiraWithdrawnTransitionId);
  await jira.transitionIssue(issueId, {
    transition: {
      id: jiraWithdrawnTransitionId,
    },
  });
}

// Marks an issue so it's excluded from future withdrawal attempts, since a failed
// transition (e.g. a Jira workflow config error) will otherwise be retried every run
async function addWithdrawFailedLabel(issueId) {
  try {
    await jira.updateIssue(issueId, {
      update: {
        labels: [
          {
            add: withdrawFailedLabel,
          },
        ],
      },
    });
  } catch (err) {
    console.log(
      `Error adding withdraw-failed label to issue ${issueId} in jira`,
      err,
    );
  }
}

// Using fetch to hit API as getUser in jira-client uses different api version with different parameters
async function getUserByKey(key) {
  const token = config.get("jira.api_token");
  try {
    const response = await fetch(
      `https://tools.hmcts.net/jira/rest/api/2/user?key=${key}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer: ${token}`,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      console.error(
        `Error fetching user with key ${key}, HTTP error! status: ${response.status}`,
      );
      return;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching user with key ${key}`, error);
  }
}

module.exports.resolveHelpRequest = resolveHelpRequest;
module.exports.startHelpRequest = startHelpRequest;
module.exports.assignHelpRequest = assignHelpRequest;
module.exports.createHelpRequest = createHelpRequest;
module.exports.updateHelpRequestDescription = updateHelpRequestDescription;
module.exports.addCommentToHelpRequest = addCommentToHelpRequest;
module.exports.addCommentToHelpRequestResolve = addCommentToHelpRequestResolve;
module.exports.addLabel = addLabel;
module.exports.convertEmail = convertEmail;
module.exports.extraJiraId = extraJiraId;
module.exports.extractJiraIdFromBlocks = extractJiraIdFromBlocks;
module.exports.searchForUnassignedOpenIssues = searchForUnassignedOpenIssues;
module.exports.searchForOpenIssues = searchForOpenIssues;
module.exports.searchForIssuesAssignedTo = searchForIssuesAssignedTo;
module.exports.searchForIssuesRaisedBy = searchForIssuesRaisedBy;
module.exports.getIssueDescription = getIssueDescription;
module.exports.markAsDuplicate = markAsDuplicate;
module.exports.updateHelpRequestType = updateHelpRequestType;
module.exports.search = search;
module.exports.searchForInactiveIssues = searchForInactiveIssues;
module.exports.INACTIVITY_STAGES = INACTIVITY_STAGES;
module.exports.addInactivityNotificationLabel = addInactivityNotificationLabel;
module.exports.withdrawIssue = withdrawIssue;
module.exports.addWithdrawnLabel = addWithdrawnLabel;
module.exports.addWithdrawFailedLabel = addWithdrawFailedLabel;
module.exports.removeWithdrawnLabel = removeWithdrawnLabel;
module.exports.getUserByKey = getUserByKey;
