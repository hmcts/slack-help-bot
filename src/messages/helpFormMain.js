const { optionBlock } = require("./util");

function helpFormMainBlocks({ user, isAdvanced, errorMessage, helpRequest }) {
    return [
        {
            type: "header",
            text: {
                type: "plain_text",
                text: "Platform Help Request",
                emoji: true,
            },
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: "Please fill out the following form and we'll raise a platform help ticket for you:",
            },
        },
        {
            type: "input",
            element: {
                type: "plain_text_input",
                action_id: "summary",
                initial_value: helpRequest?.summary ?? "",
            },
            label: {
                type: "plain_text",
                text: "Issue Summary",
                emoji: true,
            },
        },
        {
            type: "input",
            element: {
                type: "static_select",
                placeholder: {
                    type: "plain_text",
                    text: "Select an item",
                    emoji: true,
                },
                options: [
                    optionBlock("AAT / Staging", "staging"),
                    optionBlock("Preview / Dev", "dev"),
                    optionBlock("Production"),
                    optionBlock("Perftest / Test", "test"),
                    optionBlock("ITHC"),
                    optionBlock("N/A", "none"),
                ],
                action_id: "environment",
                // Arcane javascript alchemy to only provide initial_option if we have a value for it
                ...(helpRequest?.environment && {
                    initial_option: helpRequest.environment,
                }),
            },
            label: {
                type: "plain_text",
                text: "Environment :house_with_garden:",
                emoji: true,
            },
        },
        {
            type: "input",
            element: {
                type: "static_select",
                placeholder: {
                    type: "plain_text",
                    text: "Select an item",
                    emoji: true,
                },
                options: [
                    optionBlock("Access Management", "am"),
                    optionBlock("Architecture"),
                    optionBlock("Bulk scan", "bulkscan"),
                    optionBlock("Bulk print", "bulkprint"),
                    optionBlock("CCD"),
                    optionBlock("Civil Unspecified", "CivilUnspec"),
                    optionBlock("CMC"),
                    optionBlock("Divorce"),
                    optionBlock("No fault divorce", "nfdivorce"),
                    optionBlock("Ethos"),
                    optionBlock("Evidence Management", "evidence"),
                    optionBlock("Expert UI", "xui"),
                    optionBlock("Financial Remedy", "finrem"),
                    optionBlock("FPLA"),
                    optionBlock("Family Private Law", "FPRL"),
                    optionBlock("Heritage"),
                    optionBlock("HMI"),
                    optionBlock("Management Information", "mi"),
                    optionBlock("IDAM"),
                    optionBlock("Private Law", "private-law"),
                    optionBlock("Reference Data", "refdata"),
                    optionBlock(
                        "Reform Software Engineering",
                        "reform-software-engineering",
                    ),
                    optionBlock(
                        "Security Operations or Secure design",
                        "security",
                    ),
                    optionBlock("SSCS"),
                    optionBlock("PayBubble"),
                    optionBlock("PET"),
                    optionBlock("Work Allocation", "workallocation"),
                    optionBlock("Other"),
                ],
                action_id: "team",
                ...(helpRequest?.team && { initial_option: helpRequest.team }),
            },
            label: {
                type: "plain_text",
                text: "Team :busts_in_silhouette:",
                emoji: true,
            },
        },
        {
            type: "input",
            element: {
                type: "static_select",
                placeholder: {
                    type: "plain_text",
                    text: "Select an item",
                    emoji: true,
                },
                options: [
                    optionBlock("AKS"),
                    optionBlock("Azure"),
                    optionBlock("Azure DevOps", "azure-devops"),
                    optionBlock("Database read", "DBQuery"),
                    optionBlock("Database update", "DBUpdate"),
                    optionBlock("Elasticsearch"),
                    optionBlock("GitHub"),
                    optionBlock("Jenkins"),
                    optionBlock("Question"),
                    optionBlock("SSL"),
                    optionBlock("VPN"),
                    optionBlock("Other"),
                ],
                action_id: "area",
                ...(helpRequest?.area && { initial_option: helpRequest.area }),
            },
            label: {
                type: "plain_text",
                text: "Area :globe_with_meridians:",
                emoji: true,
            },
        },
        {
            type: "input",
            element: {
                type: "plain_text_input",
                action_id: "build_url",
                initial_value: helpRequest?.prBuildUrl ?? "",
            },
            label: {
                type: "plain_text",
                text: "PR / Build URLs :link: (Optional)",
                emoji: true,
            },
            optional: true,
        },
        {
            type: "divider",
        },
        {
            type: "input",
            element: {
                type: "plain_text_input",
                multiline: true,
                action_id: "description",
                initial_value: helpRequest?.description ?? "",
            },
            label: {
                type: "plain_text",
                text: "Description :spiral_note_pad:",
                emoji: true,
            },
        },
        {
            type: "input",
            element: {
                type: "plain_text_input",
                multiline: true,
                action_id: "analysis",
                initial_value: helpRequest?.analysis ?? "",
            },
            label: {
                type: "plain_text",
                text: "Analysis :thinking_face: (Optional)",
                emoji: true,
            },
            optional: true,
        },
        {
            type: "input",
            element: {
                type: "radio_buttons",
                options: [
                    {
                        text: {
                            type: "plain_text",
                            text: "Yes",
                            emoji: true,
                        },
                        value: "true",
                    },
                    {
                        text: {
                            type: "plain_text",
                            text: "No",
                            emoji: true,
                        },
                        value: "false",
                    },
                ],
                action_id: "team_check",
                ...(helpRequest?.checkedWithTeam && {
                    initial_option: helpRequest.checkedWithTeam,
                }),
            },
            label: {
                type: "plain_text",
                text: "Have You Checked With Your Team? :speech_balloon:",
                emoji: true,
            },
        },
        isAdvanced
            ? {
                  type: "section",
                  text: {
                      type: "mrkdwn",
                      text: `<@${user}> submitted *Platform Help Request*`,
                  },
              }
            : {
                  type: "section",
                  text: {
                      type: "mrkdwn",
                      text: `${
                          errorMessage?.length > 0 ? ":x: " + errorMessage : " "
                      }`,
                  },
                  accessory: {
                      type: "button",
                      text: {
                          type: "plain_text",
                          text: "Submit",
                          emoji: true,
                      },
                      value: "submit_help_request",
                      action_id: "submit_help_request",
                  },
              },
    ];
}

module.exports.helpFormMainBlocks = helpFormMainBlocks;
