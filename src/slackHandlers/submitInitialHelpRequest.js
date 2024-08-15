const { helpFormMainBlocks } = require("../messages");
const {
  helpFormAnalyticsBlocks,
  helpFormRelatedIssuesBlocks,
  helpFormKnowledgeStoreBlocks,
} = require("../messages/helpFormMain");
const { checkSlackResponseError } = require("./errorHandling");
const { queryAi } = require("./utils/aiCache");

function validateInitialRequest(helpRequest) {
  let errorMessage = null;

  // prBuildUrl and analysis are optional, so don't mandate they be populated
  if (!helpRequest.summary) {
    errorMessage = "Please write a summary for your issue.";
  } else if (!helpRequest.description) {
    errorMessage = "Please provide a description of your issue.";
  }
  return errorMessage;
}

async function submitInitialHelpRequest(body, client, source) {
  try {
    const user = body.user.id;

    const values = Object.values(body.state.values).reduce(
      (r, c) => Object.assign(r, c),
      {},
    );
    const blocks = body.message.blocks;

    // New inputs will be found in our 'values' object if present.
    // If there is a validation problem with the form, it must be re-sent
    // to the user in its entirety and the submitted data will be lost.
    //
    // The only way to keep the data the user entered in the form is to
    // populate the initial_value or initial_option fields of the form when
    // it's sent back. We do this by passing 'helpRequest' to the
    // 'helpRequestRaiseTicketBlocks' function and setting the fields in
    // there.
    //
    // The form can then be re-submitted by the user.
    // If the user did not change a field when re-submitting the form,
    // slack will detect this and will not populate the 'values' object
    // with the value of that field. Instead, we have to read the data from
    // the 'blocks' object we submitted last time. Thankfully this is
    // provided to us.

    // Add an explicit check for when the values block exists, but the
    // value === null, this is a special case where the user has deleted
    // what was in the field before submitting and is a distinct case from
    // the block not being present at all. That simply means the user did
    // not update that field before submitting and the field may still
    // have a value in the initial_option block we set.

    const helpRequest = {
      user,
      // Blocks 0 and 1 are labels
      summary: values.summary
        ? values.summary.value
        : blocks[2].element.initial_value,
      prBuildUrl: values.build_url
        ? values.build_url.value
        : blocks[3].element.initial_value,
      // 4 is a divider
      description: values.description
        ? values.description.value
        : blocks[5].element.initial_value,
      analysis: values.analysis
        ? values.analysis.value
        : blocks[6].element.initial_value,
    };

    const errorMessage = validateInitialRequest(helpRequest);
    //Re-insert current values for text inputs and send the form back
    if (errorMessage != null) {
      const res = await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        text: "Raise a help request with Platform Operations",
        blocks: helpFormMainBlocks({
          user: body.user.id,
          isAdvanced: false,
          errorMessage: errorMessage,
          helpRequest: helpRequest,
        }),
      });

      checkSlackResponseError(
        res,
        "An error occurred when updating an invalid ticket raising form",
      );
    } else {
      const mainBlocks = helpFormMainBlocks({
        user: body.user.id,
        errorMessage: errorMessage,
        isAdvanced: true,
        helpRequest: helpRequest,
      });

      const notifyProcessingRequest = await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        text: "Raise a help request with Platform Operations",
        blocks: [
          ...mainBlocks,
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: ":spinner2: Processing, please wait",
            },
          },
        ],
      });
      checkSlackResponseError(
        notifyProcessingRequest,
        "An error occurred when updating a valid ticket raising form",
      );

      let relatedIssues = [];
      let knowledgeStoreResults = [];
      let aiRecommendation = {};
      try {
        const result = await queryAi(helpRequest);
        relatedIssues = result.relatedIssues;
        knowledgeStoreResults = result.knowledgeStoreResults;
        aiRecommendation = result.aiRecommendation;
      } catch (error) {
        console.log(
          "An error occurred when fetching AI recommendations",
          error,
        );
      }

      const knowledgeStoreAdvanced =
        source !== "initial" ? true : knowledgeStoreResults.length <= 0;
      const knowledgeStoreBlocks = helpFormKnowledgeStoreBlocks({
        knowledgeStoreResults,
        isAdvanced: knowledgeStoreAdvanced,
      });

      const relatedIssuesAdvanced =
        source === "related_issues" ? true : relatedIssues.length <= 0;
      const relatedIssuesBlocks = helpFormRelatedIssuesBlocks({
        // skip related issues if knowledge store results are present and next hasn't been clicked
        relatedIssues: knowledgeStoreAdvanced ? relatedIssues : [],
        isAdvanced: relatedIssuesAdvanced,
      });

      const showAnalytics = knowledgeStoreAdvanced && relatedIssuesAdvanced;
      const analyticsBlocks = showAnalytics
        ? helpFormAnalyticsBlocks({
            user: body.user.id,
            errorMessage: errorMessage,
            helpRequest: {
              ...helpRequest,
              ...aiRecommendation,
            },
          })
        : [];

      const blocks = [
        ...mainBlocks,
        ...knowledgeStoreBlocks,
        ...relatedIssuesBlocks,
        ...analyticsBlocks,
      ];

      const updateRes = await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        text: "Raise a help request with Platform Operations",
        blocks,
      });

      checkSlackResponseError(
        updateRes,
        "An error occurred when updating a valid ticket raising form",
      );
    }
  } catch (error) {
    console.error("An error occurred when submitting a help form: ", error);
  }
}

module.exports.submitInitialHelpRequest = submitInitialHelpRequest;
