function mapEnvironments(value) {
  if (value === "Preview" || value === "Dev") {
    value = "Preview / Dev";
  }
  if (value === "Perftest" || value === "Test") {
    value = "Perftest / Test";
  }
  if (value === "AAT" || value === "Staging") {
    value = "AAT / Staging";
  }

  return value;
}

function parseResponseToRecommendation(str) {
  let obj = {};
  let pairs = str.split(",");

  for (const kvPair of pairs) {
    const pair = kvPair.split("=");
    const key = pair[0].trim();
    if (key === "environment" || key === "team" || key === "area") {
      obj[key] = mapEnvironments(pair[1].trim());
    }
  }
  return obj;
}

module.exports.parseResponseToRecommendation = parseResponseToRecommendation;
