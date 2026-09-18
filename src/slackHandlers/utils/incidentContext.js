function plainSlackText(text = "") {
  return text
    .replace(/<([^|>]+)\|([^>]+)>/g, "$2")
    .replace(/<@[^>]+>/g, "user")
    .replace(/[*_~`]/g, "")
    .trim();
}

function buildIncidentContext(rootMessage, threadMessages = [], ignoredText) {
  const title = plainSlackText(
    rootMessage.blocks?.find((block) => block.type === "section")?.text?.text,
  );
  const details = threadMessages
    .flatMap((message) => message.blocks || [])
    .filter((block) => block.type === "section" && block.text?.text)
    .map((block) => plainSlackText(block.text.text))
    .filter((text) => /\b(?:Description|Analysis|Follow-up)/i.test(text))
    .slice(0, 5);
  const recentHumanMessages = threadMessages
    .filter(
      (message) =>
        !message.bot_id &&
        typeof message.text === "string" &&
        message.text !== ignoredText,
    )
    .slice(-20)
    .map((message) => plainSlackText(message.text).slice(0, 500));

  return [
    `Issue title: ${title || "Unknown"}`,
    ...details,
    ...recentHumanMessages,
  ]
    .join("\n")
    .slice(0, 8000);
}

module.exports = { plainSlackText, buildIncidentContext };
