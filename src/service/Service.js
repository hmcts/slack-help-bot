const refreshDelay = 15;

function Service(name, url) {
    this.name = name;
    this.url = url;
    this.lastSeen = 0;
}

Service.prototype.isAvailable = function () {
    const now = Date.now()
    return (now - this.lastSeen) <= refreshDelay * 2 * 1000;
}

Service.prototype.setLastSeen = function (lastSeenTime) {
    this.lastSeen = lastSeenTime;
}

Service.prototype.toString = function () {
    if(this.isAvailable()) {
        return `:white_check_mark:   <${this.url}/health|*${this.name}*> - Responded within the last few seconds.`;
    }

    const now = new Date();
    const lastSeen = new Date(this.lastSeen);
    let text = `:x:   *${this.name}* - Last seen at ${lastSeen.toLocaleTimeString('en-GB', { timeZone: 'UTC' })} (UTC) `;

    if(now.getDate() === lastSeen.getDate()) {
        return text;
    }

    if (now.getDate() - 1 === lastSeen.getDate()) {
        return text + 'yesterday.'
    }

    text += `on ${lastSeen.toLocaleString('default', { month: 'long' })} ${lastSeen.getDate()}`;

    // Append date ordinal
    if (lastSeen.getDate() > 3 && lastSeen.getDate() < 21) {
        text += 'th';
    } else {
        switch (lastSeen.getDate() % 10) {
            case 1:
                text += "st.";
                break;
            case 2:
                text += "nd.";
                break;
            case 3:
                text += "rd.";
                break;
            default:
                text += "th.";
        }
    }

    return text;
}

module.exports.Service = Service;