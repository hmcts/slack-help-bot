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

module.exports.mapEnvironments = mapEnvironments;
