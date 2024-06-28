const {
  extractJiraIdFromBlocks,
  assignHelpRequest,
} = require("../service/persistence");
const { lookupUsersEmail } = require("./utils/lookupUser");

async function assignHelpRequestToUser(action, body, client) {
  try {
    const user = action.selected_user;

    const jiraId = extractJiraIdFromBlocks(body.message.blocks);
    const userEmail = await lookupUsersEmail({ user, client });

    await assignHelpRequest(jiraId, userEmail);

    const actor = body.user.id;

    await client.chat.postMessage({
      channel: body.channel.id,
      thread_ts: body.message.ts,
      text: `Hi, <@${user}>, you've just been assigned to this help request by <@${actor}>`,
    });
  } catch (error) {
    console.error(error);
  }
}

module.exports.assignHelpRequestToUser = assignHelpRequestToUser;
