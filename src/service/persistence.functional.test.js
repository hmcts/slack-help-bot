const jira = require("./persistence");
const config = require("config");

const jiraProject = config.get("jira.project");

// TODO figure out best way to have 'functional' tests separate in jest
describe("functional tests", () => {
  test("help request is created", async () => {
    const helpRequest = {
      summary: "Test creation of issue",
      userEmail: "tim.jacomb@hmcts.net",
      labels: [],
    };

    const issueKey = await jira.createHelpRequest(helpRequest);
    expect(issueKey.startsWith(`${jiraProject}-`)).toBeTruthy();
    console.log(issueKey);
  });
  test("help request description is updated", async () => {
    const helpRequest = {
      summary: "Test creation of issue",
      prBuildUrl: undefined,
      environment: "Production",
      description: "Big large error message, something bad happened",
      analysis: "Service principal expired",
      checkedWithTeam: "Yes",
      slackLink:
        "https://platformengin-tzf2541.slack.com/archives/C01KHKNJUKE/p1611272568001500",
    };

    await jira.updateHelpRequestDescription("SBOX-104", helpRequest);
  });

  test("search for unassigned users", async () => {
    const results = await jira.searchForUnassignedOpenIssues();
    console.log(JSON.stringify(results));
  });

  test("issue is assigned to user", async () => {
    await jira.assignHelpRequest("SBOX-51", "tim.jacomb");
  });

  test("comment is added to help request", async () => {
    await jira.addCommentToHelpRequest("SBOX-58", {
      slackLink:
        "https://platformengin-tzf2541.slack.com/archives/C01KHKNJUKE/p1611324186001500",
      name: "Alice",
      message: "Can anyone help?",
    });
  });

  test("resolution comment is added to help request", async () => {
    await jira.addCommentToHelpRequestResolve("SBOX-58", {
      slackLink:
        "https://platformengin-tzf2541.slack.com/archives/C01KHKNJUKE/p1611324186001500",
      category: "Other issue",
      how: "No issue found",
    });
  });

  test("resolution label is added to help request", async () => {
    await jira.addLabel("SBOX-58", {
      slackLink:
        "https://platformengin-tzf2541.slack.com/archives/C01KHKNJUKE/p1611324186001500",
      category: "Other-issue",
    });
  });

  test("issue is closed as duplicate", async () => {
    await jira.markAsDuplicate("SBOX-219", "SBOX-118");
  });

  test("issue is in progress", async () => {
    await jira.startHelpRequest("SBOX-51");
  });

  test("issue is resolved", async () => {
    await jira.resolveHelpRequest("SBOX-51");
  });
});
