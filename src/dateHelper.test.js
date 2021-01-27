const dateHelper = require('./dateHelper')

describe('convertIso8601ToEpochSeconds', () => {
    it('returns undefined if undefined', () => {
        expect(dateHelper.convertIso8601ToEpochSeconds(undefined)).toBe(undefined)
    })
    it('converts iso time to epoch second', () => {
        expect(dateHelper.convertIso8601ToEpochSeconds('2021-01-26T12:00:20.000+0000'))
            .toBe(1611662420)
    })
})
