const { searchForUnassignedOpenIssues } = require("../../service/persistence");
const {
  appHomeIssueBlocks,
  appHomeMainBlocks,
  appHomeHeaderBlocks,
} = require("../../messages");
const { extractSlackLinkFromText } = require("../../messages/util");

async function appHomeUnassignedIssues(userId, client) {
  try {
    const results = await searchForUnassignedOpenIssues();

    const issues = results.issues.slice(0, 20);

    const parsedPromises = issues.flatMap(async (result) => {
      let reporterUser;
      try {
        reporterUser = await client.users.lookupByEmail({
          email: result.fields.reporter.emailAddress,
        });
      } catch (error) {
        console.log("Couldn't find user", result.fields.reporter.emailAddress);
      }

      return appHomeIssueBlocks({
        summary: result.fields.summary,
        slackLink: extractSlackLinkFromText(result.fields.description),
        jiraId: result.key,
        created: result.fields.created,
        updated: result.fields.updated,
        state: "Open :fire:",
        assignee: null,
        reporter: reporterUser?.user?.enterprise_user?.id,
      });
    });

    const parsedResults = await Promise.all(parsedPromises);

    await client.views.publish({
      user_id: userId,
      view: {
        type: "home",
        blocks: [
          ...appHomeMainBlocks(),
          ...appHomeHeaderBlocks(
            "Open Unassigned Help Requests",
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

module.exports.appHomeUnassignedIssues = appHomeUnassignedIssues;
