const {
  extractJiraIdFromBlocks,
  assignHelpRequest,
} = require("../service/persistence");

async function assignHelpRequestToMe(body, client) {
  try {
    const jiraId = extractJiraIdFromBlocks(body.message.blocks);

    const userInfo = await client.users.info({
      user: body.user.id,
    });

    const userEmail = userInfo.user.profile.email;
    await assignHelpRequest(jiraId, userEmail);

    const blocks = body.message.blocks;
    const assignedToSection = blocks[6];

    assignedToSection.elements[0].initial_user =
      userInfo.user.enterprise_user.id;

    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: "New platform help request raised",
      blocks: blocks,
    });
  } catch (error) {
    console.error(error);
  }
}

module.exports.assignHelpRequestToMe = assignHelpRequestToMe;
