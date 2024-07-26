const {
  helpFormMainBlocks,
  helpRequestMainBlocks,
  helpRequestDetailBlocks,
  helpFormGoodbyeBlocks,
} = require("../messages");
const { helpFormAnalyticsBlocks } = require("../messages/helpFormMain");
const {
  createHelpRequest,
  updateHelpRequestDescription,
} = require("../service/persistence");
const { checkSlackResponseError } = require("./errorHandling");
const { lookupUsersEmail } = require("./utils/lookupUser");
const config = require("config");
const { createHelpRequestInCosmos } = require("../service/cosmos");
const { uuidv7 } = require("uuidv7");

const reportChannel = config.get("slack.report_channel");

function validateFullRequest(helpRequest) {
  // prBuildUrl and analysis are optional, so don't mandate they be populated
  if (!helpRequest.summary) {
    return "Please write a summary for your issue.";
  } else if (!helpRequest.environment) {
    return "Please specify what environment the issue is occurring in.";
  } else if (!helpRequest.team) {
    // TODO: Tell the user how to request a new team be added to the list
    return "Please specify the team experiencing the problem.";
  } else if (!helpRequest.area) {
    return "Please specify what area you're experiencing problems with.";
  } else if (!helpRequest.description) {
    return "Please provide a description of your issue.";
  }
  return null;
}

function cleanLabel(label) {
  return label.replace(" ", "-").toLowerCase();
}

async function submitHelpRequest(body, client) {
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
    // Slack will detect this and will not populate the 'values' object
    // with the value of that field. Instead, we have to read the data from
    // the 'blocks' object we submitted last time. Thankfully this is
    // provided to us.

    // Add an explicit check for when the values block exists, but the
    // value === null, this is a special case where the user has deleted
    // what was in the field before submitting and is a distinct case from
    // the block not being present at all. That simply means the user did
    // not update that field before submitting and the field may still
    // have a value in the initial_option block we set.

    const inputBlocks = blocks.filter((block) => block.type === "input");

    const helpRequest = {
      user,
      // Blocks 0 and 1 are labels
      summary: values.summary
        ? values.summary.value
        : inputBlocks[0].element.initial_value,
      prBuildUrl: values.build_url
        ? values.build_url.value
        : inputBlocks[1].element.initial_value,
      description: values.description
        ? values.description.value
        : inputBlocks[2].element.initial_value,
      analysis: values.analysis
        ? values.analysis.value
        : inputBlocks[3].element.initial_value,
      environment: values.environment
        ? values.environment.selected_option
        : inputBlocks[4].element.initial_option,
      team: values.team
        ? values.team.selected_option
        : inputBlocks[5].element.initial_option,
      area: values.area
        ? values.area.selected_option
        : inputBlocks[6].element.initial_option,
    };

    const errorMessage = validateFullRequest(helpRequest);
    //Re-insert current values for text inputs and send the form back
    if (errorMessage !== null) {
      let mainBlocks = helpFormMainBlocks({
        user: body.user.id,
        isAdvanced: true,
        helpRequest: helpRequest,
      });

      const analyticsBlocks = helpFormAnalyticsBlocks({
        user: body.user.id,
        errorMessage: errorMessage,
        helpRequest,
      });

      const blocks = [...mainBlocks, ...analyticsBlocks];

      const res = await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        text: "Raise a help request With Platform Operations",
        errorMessage: errorMessage,
        blocks,
      });

      checkSlackResponseError(
        res,
        "An error occurred when updating an invalid ticket raising form",
      );
      return;
    } else {
      const mainBlocks = helpFormMainBlocks({
        user: body.user.id,
        errorMessage: errorMessage,
        isAdvanced: true,
        helpRequest: helpRequest,
      });

      const analyticsBlocks = helpFormAnalyticsBlocks({
        user: body.user.id,
        errorMessage: errorMessage,
        isAdvanced: true,
        helpRequest,
      });

      const blocks = [...mainBlocks, ...analyticsBlocks];

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

    const userEmail = await lookupUsersEmail({ user, client });

    // using JIRA version v8.15.0#815001-sha1:9cd993c:node1,
    // check if API is up-to-date
    const jiraId = await createHelpRequest({
      summary: helpRequest.summary,
      userEmail,
      labels: [
        cleanLabel(`area-${helpRequest.area.value}`),
        cleanLabel(`team-${helpRequest.team.value}`),
      ],
    });

    const mainRes = await client.chat.postMessage({
      channel: reportChannel,
      text: "New platform help request raised",
      blocks: helpRequestMainBlocks({
        ...helpRequest,
        jiraId,
      }),
    });

    checkSlackResponseError(
      mainRes,
      "An error occurred when posting a help request to Slack",
    );

    const detailsRes = await client.chat.postMessage({
      channel: reportChannel,
      thread_ts: mainRes.message.ts,
      text: "New platform help request raised",
      blocks: helpRequestDetailBlocks(helpRequest),
    });

    checkSlackResponseError(
      detailsRes,
      "An error occurred when posting details of a help request to Slack",
    );

    const permaLink = (
      await client.chat.getPermalink({
        channel: mainRes.channel,
        message_ts: mainRes.message.ts,
      })
    ).permalink;

    await updateHelpRequestDescription(jiraId, {
      ...helpRequest,
      slackLink: permaLink,
    });

    const goodbyeRes = await client.chat.postMessage({
      channel: body.channel.id,
      text: "Help request submitted",
      blocks: helpFormGoodbyeBlocks({
        helpRequestUrl: permaLink,
      }),
    });

    checkSlackResponseError(
      goodbyeRes,
      "An error occurred when posting a goodbye post to Slack",
    );

    await createHelpRequestInCosmos({
      id: uuidv7(),
      created_at: new Date(),
      key: jiraId,
      status: "Open",
      title: helpRequest.summary,
      description: helpRequest.description,
      analysis: helpRequest.analysis,
      url: permaLink,
    });
  } catch (error) {
    console.error("An error occurred when submitting a help form: ", error);
  }
}

module.exports.submitHelpRequest = submitHelpRequest;
