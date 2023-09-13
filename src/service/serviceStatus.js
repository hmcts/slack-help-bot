const fetch = require('node-fetch-retry');
const {Service} = require("./Service");

const refreshDelay = 15;
const services = {
    'AAT': getNonProdServices('aat'),
    'PERFTEST': getNonProdServices('perftest'),
    'ITHC': getNonProdServices('ithc'),
    'DEMO': getNonProdServices('demo'),
    'PROD': [
        new Service('rpx-xui-webapp', `https://manage-case.platform.hmcts.net`),
        new Service('ccd-data-store-api', `http://ccd-data-store-api-prod.service.core-compute-prod.internal`)
    ]
}

function getAllServiceStatus() {
    return services;
}

function getNonProdServices(env) {
    return [
        new Service('rpx-xui-webapp', `https://manage-case.${env}.platform.hmcts.net`),
        new Service('ccd-data-store-api', `http://ccd-data-store-api-${env}.service.core-compute-${env}.internal`)
    ]
}

function monitorStatus() {
    Object.entries(services).forEach(([env, services]) => {
        services.forEach(service => {
            const controller = new AbortController();
            const signal = controller.signal;

            new Promise((resolve, reject) => {
                fetch(service.url + '/health', { signal, retry: 3, pause: 1500, silent: true })
                    .then(response => {
                        if(response.ok) {
                            resolve(response.json())
                        } else {
                            reject(`${response.status} - ${response.statusText}`)
                        }
                    })
                    .catch(reject);

                setTimeout(() => {
                    controller.abort();
                    reject();
                }, refreshDelay * 1000);
            })
                .then(data => {
                    if(data.status === 'UP') {
                        service.setLastSeen((Date.now()));
                        // TODO: Check whether it was previously down; post to a channel that it's back; reset reported down marker?
                    }
                })
                .catch((e) => {
                    console.log('Failed to connect to ' + service.url + ' after 3 retries - ' + e);
                    // TODO: Post to a channel; mark as reported down to avoid repeats?
                });
        })
    })
}

monitorStatus();
setInterval(monitorStatus, refreshDelay * 1000)

module.exports.getAllServiceStatus = getAllServiceStatus;