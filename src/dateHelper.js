function convertIso8601ToEpochSeconds(isoTime) {
    if (isoTime === undefined) {
        return undefined
    }

    return Date.parse(isoTime) / 1000
}

module.exports.convertIso8601ToEpochSeconds = convertIso8601ToEpochSeconds
