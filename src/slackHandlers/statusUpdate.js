// src/slackHandlers/statusUpdate.js
const { updateJiraIssueStatus } = require("../modules/jira");

/**
 * Extract Jira key from thread messages
 * @param {Object} client - Slack client
 * @param {string} channelId - Channel ID
 * @param {string} threadTs - Thread timestamp
 * @returns {Promise<string|null>} - Jira key or null
 */
async function extractJiraKeyFromThread(client, channelId, threadTs) {
  try {
    // Get the thread messages
    const result = await client.conversations.replies({
      channel: channelId,
      ts: threadTs,
      limit: 10,
    });

    if (!result.messages || result.messages.length === 0) {
      return null;
    }

    // Look through all messages in the thread
    for (const message of result.messages) {
      const text = message.text || '';
      
      // Look for Jira key patterns
      const jiraKeyMatch = text.match(/([A-Z]+-\d+)/);
      if (jiraKeyMatch) {
        return jiraKeyMatch[1];
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting Jira key from thread:', error);
    return null;
  }
}

/**
 * Handle the status-update command (supports both "status-update" and "status")
 * @param {Object} command - The command payload from Slack
 * @param {Object} client - Slack client
 */
async function handleStatusUpdate(command, client) {
  const { user_id, channel_id, text, thread_ts } = command;
  
  console.log("statusUpdate called with text:", text);
  console.log("Thread timestamp:", thread_ts);
  
  // Clean up the text - remove Slack's link formatting
  let cleanText = text
    .replace(/<https?:\/\/[^|]+\|/g, '')  // Remove Slack link format: <https://...| 
    .replace(/[<>]/g, '')                  // Remove any remaining < >
    .replace(/\|/g, '')                    // Remove pipe characters
    .replace(/\s+/g, ' ')                  // Normalize spaces
    .trim();
  
  // Remove "status-update" or "status" if present
  if (cleanText.startsWith('status-update')) {
    cleanText = cleanText.replace('status-update', '').trim();
  } else if (cleanText.startsWith('status')) {
    cleanText = cleanText.replace('status', '').trim();
  }
  
  console.log("Clean text after removing command:", cleanText);
  
  let jiraKey = null;
  let newStatus = null;
  
  // Try to extract Jira key from the command text first
  const jiraKeyMatch = cleanText.match(/([A-Z]+-\d+)/);
  
  if (jiraKeyMatch) {
    // Jira key found in the command
    jiraKey = jiraKeyMatch[1];
    
    // Extract the status - everything after the Jira key
    const afterKey = cleanText.substring(cleanText.indexOf(jiraKey) + jiraKey.length).trim();
    newStatus = afterKey.replace(/^["']|["']$/g, "").trim();
    
    console.log(`Found Jira key in command: ${jiraKey}`);
  } else {
    // No Jira key in command - try to extract from thread
    console.log("No Jira key in command, trying to extract from thread...");
    
    jiraKey = await extractJiraKeyFromThread(client, channel_id, thread_ts);
    
    if (jiraKey) {
      // The entire cleanText is the status (since no Jira key was in the command)
      newStatus = cleanText.replace(/^["']|["']$/g, "").trim();
      console.log(`Auto-detected Jira key from thread: ${jiraKey}`);
    }
  }
  
  // Validate we have both Jira key and status
  if (!jiraKey) {
    await client.chat.postEphemeral({
      channel: channel_id,
      user: user_id,
      text: "❌ Could not find Jira ticket number. Please specify it:\n" +
            "`@PlatOps help status DTSPO-123 'In Progress'`\n\n" +
            "Or make sure you're using this command in a help request thread.",
    });
    return;
  }
  
  if (!newStatus) {
    await client.chat.postEphemeral({
      channel: channel_id,
      user: user_id,
      text: `❌ Please specify a new status for ${jiraKey}.\n` +
            "Example: `@PlatOps help status 'In Progress'`",
    });
    return;
  }
  
  try {
    console.log(`Updating ${jiraKey} to "${newStatus}"`);
    
    // Update Jira
    await updateJiraIssueStatus(jiraKey, newStatus);
    
    // Post confirmation to Slack thread
    await client.chat.postMessage({
      channel: channel_id,
      thread_ts: thread_ts,
      text: `:white_check_mark: *Status Updated*\nTicket ${jiraKey} status changed to: *${newStatus}*\nUpdated by: <@${user_id}>`,
    });
    
    // DM the user confirmation
    await client.chat.postEphemeral({
      channel: channel_id,
      user: user_id,
      text: `✅ Successfully updated ${jiraKey} to "${newStatus}"`,
    });
    
  } catch (error) {
    console.error(`Error updating status for ${jiraKey}:`, error);
    await client.chat.postEphemeral({
      channel: channel_id,
      user: user_id,
      text: `❌ Failed to update ticket status: ${error.message}`,
    });
  }
}

module.exports = {
  handleStatusUpdate,
};
