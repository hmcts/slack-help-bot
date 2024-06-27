const { searchForIssuesRaisedBy } = require("../../service/persistence");
const {
  appHomeIssueBlocks,
  appHomeMainBlocks,
  appHomeHeaderBlocks,
} = require("../../messages");
const { extractSlackLinkFromText } = require("../../messages/util");
const { lookupUsersEmail } = require("../utils/lookupUser");

async function viewRequestsRaisedByMe(body, client) {
  try {
    const user = body.user.id;

    let userEmail;
    try {
      userEmail = lookupUsersEmail({ user, client });
    } catch (error) {
      console.log("Couldn't find user", body.user.id, error);
    }

    const results = await searchForIssuesRaisedBy(userEmail);

    const issues = results.issues.slice(0, 20);

    const parsedPromises = issues.flatMap(async (result) => {
      const assigneeUser =
        result.fields.assignee === null
          ? null
          : (
              await client.users.lookupByEmail({
                email: result.fields.assignee.emailAddress,
              })
            ).user.enterprise_user.id;

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
        assignee: assigneeUser,
        reporter: body.user.id,
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
            "Help Requests Raised by You",
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

module.exports.viewRequestsRaisedByMe = viewRequestsRaisedByMe;
