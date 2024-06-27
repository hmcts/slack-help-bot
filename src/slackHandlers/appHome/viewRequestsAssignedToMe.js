const { searchForIssuesAssignedTo } = require("../../service/persistence");
const {
  appHomeIssueBlocks,
  appHomeMainBlocks,
  appHomeHeaderBlocks,
} = require("../../messages");
const { extractSlackLinkFromText } = require("../../messages/util");
const { lookupUsersEmail } = require("../utils/lookupUser");

async function viewRequestsAssignedToMe(body, client) {
  try {
    const user = body.user.id;
    const userEmail = lookupUsersEmail({ user, client });

    const results = await searchForIssuesAssignedTo(userEmail);

    const issues = results.issues.slice(0, 20);

    const parsedPromises = issues.flatMap(async (result) => {
      let reporterUser;
      try {
        reporterUser = await client.users.lookupByEmail({
          email: result.fields.reporter.emailAddress,
        });
      } catch (error) {
        console.log(
          "Couldn't find user",
          result.fields.reporter.emailAddress,
          error,
        );
      }

      return appHomeIssueBlocks({
        summary: result.fields.summary,
        slackLink: extractSlackLinkFromText(result.fields.description),
        jiraId: result.key,
        created: result.fields.created,
        updated: result.fields.updated,
        state:
          result.fields.status.name === "Open"
            ? "Open :fire:"
            : "In Progress :fire_extinguisher:",
        assignee: body.user.id,
        reporter: reporterUser.user.enterprise_user.id,
      });
    });

    const parsedResults = await Promise.all(parsedPromises);

    await client.views.publish({
      user_id: user,
      view: {
        type: "home",
        blocks: [
          ...appHomeMainBlocks(),
          ...appHomeHeaderBlocks(
            "Help Requests Assigned to You",
            `Displaying ${issues.length} of ${results.issues.length} results.`,
          ),
          ...parsedResults.flat(),
        ],
      },
    });
  } catch (error) {
    console.error(error);
  }
}

module.exports.viewRequestsAssignedToMe = viewRequestsAssignedToMe;
