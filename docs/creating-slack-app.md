# Creating the slack app 

1. Create a new app.

<img src="images/step1.png" width=50% height=50% />

2. Head to socket mode and enable it. You will then be asked to create a new token (call it **jira-integration**) This will only have **connections:write** in the scope. Select **Generate**. Make sure to write down the generated token as this will be required for the slack-help-bot configuration.

<img src="images/step2.png" width=50% height=50% />

3. Head to **Event subscriptions** and enable it. 

<img src="images/step3.png" width=50% height=50% />

4. Expand the **Subscribe to bot events** tab, add the following settings and save changes.

<img src="images/step4.png" width=50% height=50% />

5. Expand the **Subscribe to events on behalf of users** tab, add the following settings and save changes.

<img src="images/step5.png" width=50% height=50% />

6. Head to **Interactivity and shortcuts** and create a **Global** shortcut with the following settings and save changes. 

<img src="images/step6.png" width=50% height=50% />

7. Head to **Oauth and Permissions** and install the app to your workspace. Allow the app the default permissions. Copy the generated **Bot User OAuth Access Token** as this will be required for the slack-help-bot configuration. 

<img src="images/step7.png" width=50% height=50% />

8. Add the app in the channel where you would like it to be used. Make a note of the **channelID** as this will later be required in the slack-help-bot configuration.






