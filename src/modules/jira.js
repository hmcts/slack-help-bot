const axios = require("axios");
const dotenv = require('dotenv');

// Load .env file
dotenv.config();

/**
 * Update a Jira issue's status using Personal Access Token
 * @param {string} issueKey - The Jira issue key (e.g., DTSPO-34341)
 * @param {string} newStatus - The new status name (e.g., "In Progress", "Done")
 */
async function updateJiraIssueStatus(issueKey, newStatus) {
  try {
    console.log(`Attempting to update ${issueKey} to "${newStatus}"`);
    
    // Read from environment with fallback
    const jiraBaseUrl = "https://tools.hmcts.net/jira";
    const personalAccessToken = process.env.JIRA_PAT;
    
    console.log(`Using Jira URL: ${jiraBaseUrl}`);
    console.log(`Using PAT: ${personalAccessToken ? personalAccessToken.substring(0, 10) + '...' : 'NOT SET'}`);
    
    if (!personalAccessToken) {
      throw new Error('JIRA_PAT is not set!');
    }
    
    // Try different API versions
    const apiVersions = ['/rest/api/2', '/rest/api/3'];
    
    for (const apiVersion of apiVersions) {
      try {
        const url = `${jiraBaseUrl}${apiVersion}/issue/${issueKey}/transitions`;
        console.log(`Trying API endpoint: ${url}`);
        
        const headers = {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${personalAccessToken}`
        };
        
        const response = await axios.get(url, { headers });
        
        console.log(`✅ Successfully connected to Jira using ${apiVersion}`);
        console.log(`Response status: ${response.status}`);
        
        if (!response.data || !response.data.transitions) {
          console.error('No transitions found:', response.data);
          throw new Error(`Could not find transitions for ticket ${issueKey}`);
        }
        
        const transitions = response.data.transitions;
        console.log(`Available transitions for ${issueKey}:`);
        transitions.forEach(t => {
          console.log(`  - ${t.to.name} (id: ${t.id})`);
        });
        
        // Find the transition ID for the target status
        const transition = transitions.find(
          (t) => t.to.name.toLowerCase() === newStatus.toLowerCase()
        );
        
        if (!transition) {
          const availableStatuses = transitions
            .map((t) => t.to.name)
            .join(", ");
          throw new Error(
            `Status "${newStatus}" is not a valid transition. Available: ${availableStatuses}`
          );
        }
        
        console.log(`Found transition: ${transition.to.name} (id: ${transition.id})`);
        
        // Perform the transition
        await axios.post(
          `${jiraBaseUrl}${apiVersion}/issue/${issueKey}/transitions`,
          {
            transition: {
              id: transition.id,
            },
          },
          { headers }
        );
        
        console.log(`✅ Updated ${issueKey} to status: ${newStatus}`);
        return { success: true, message: `Updated ${issueKey} to ${newStatus}` };
        
      } catch (error) {
        if (error.response && error.response.status === 404) {
          console.log(`API version ${apiVersion} not found, trying next...`);
          continue;
        }
        throw error;
      }
    }
    
    throw new Error('Could not find Jira API endpoint. Tried versions: ' + apiVersions.join(', '));
    
  } catch (error) {
    console.error(`❌ Error updating status for ${issueKey}:`, error.message);
    if (error.response) {
      console.error(`Jira API response: ${error.response.status} - ${error.response.statusText}`);
      console.error(`Response data:`, JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received from Jira - check network connectivity');
    }
    throw error;
  }
}

module.exports = {
  updateJiraIssueStatus,
};
