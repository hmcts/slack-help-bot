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

const jiraProject = config.get("jira.project");

const jiraStartTransitionId = config.get("jira.start_transition_id");
const jiraWithdrawnTransitionId = config.get("jira.withdrawn_transition_id");
const jiraDoneTransitionId = config.get("jira.done_transition_id");
const extractProjectRegex = new RegExp(`(${jiraProject}-[\\d]+)`);

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

  project = extractProjectRegex.exec(viewOnJiraText);

  return project ? project[1] : "undefined";
}

function extraJiraId(text) {
  return extractProjectRegex.exec(text)[1];
}

async function convertEmail(email) {
  if (!email) {
    return systemUser;
  }

  try {
    const res = await jira.searchUsers({
      username: email,
      maxResults: 1,
    });

    if (!res || res.length === 0) {
      console.log("Failed to find user in Jira with email: " + email);
      return undefined;
    }

    return res[0].name;
  } catch (ex) {
    console.log("Querying username failed: " + ex);
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
  const user = await convertEmail(userEmail);
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
  const user = await convertEmail(userEmail);
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
  const user = await convertEmail(email);

  try {
    await jira.updateAssignee(issueId, user);
  } catch (err) {
    console.log("Error assigning help request in jira", err);
  }
}

async function createHelpRequestInJira(summary, project, user, labels) {
  console.log(`Creating help request in Jira for user: ${user}`);
  return await jira.addNewIssue({
    fields: {
      summary: summary,
      issuetype: {
        id: issueTypeId,
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

async function createHelpRequest({ summary, userEmail, labels }) {
  const user = await convertEmail(userEmail);

  const project = await jira.getProject(jiraProject);

  // https://developer.atlassian.com/cloud/jira/platform/rest/v2/api-group-issues/#api-rest-api-2-issue-post
  // note: fields don't match 100%, our Jira version is a bit old (still a supported LTS though)

  let result;
  try {
    result = await createHelpRequestInJira(summary, project, user, labels);
  } catch (err) {
    // in case the user doesn't exist in Jira use the system user
    result = await createHelpRequestInJira(
      summary,
      project,
      systemUser,
      labels,
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
    console.log("Error creating comment in jira", err);
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
    console.log("Error creating comment in jira", err);
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
    console.log("Error updating help request description in jira", err);
  }
}

async function searchForInactiveIssues() {
  const jqlQuery = `project = ${jiraProject} AND type = "${issueTypeName}" AND status IN ("In Progress") AND updated <= -10d`;
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
module.exports.search = search;
module.exports.searchForInactiveIssues = searchForInactiveIssues;
module.exports.withdrawIssue = withdrawIssue;
module.exports.addWithdrawnLabel = addWithdrawnLabel;
module.exports.removeWithdrawnLabel = removeWithdrawnLabel;
module.exports.getUserByKey = getUserByKey;
