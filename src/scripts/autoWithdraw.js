const {
  searchForInactiveIssues,
  withdrawIssue,
  addWithdrawnLabel,
} = require("../service/persistence");

const withdrawInactiveIssues = async () => {
  const results = await searchForInactiveIssues();

  if (results.issues.length > 0) {
    for (const issue of results.issues) {
      const issueId = issue["key"];

      console.log(`Withdrawing issue ${issueId}...`);
      await addWithdrawnLabel("DTSPO-17503"); // replace with issueId
      await withdrawIssue("DTSPO-17503"); // replace with issueId
      console.log(`Issue ${issueId} withdrawn`);
    }
  } else {
    console.log("No issues to withdraw");
  }
};

withdrawInactiveIssues();
