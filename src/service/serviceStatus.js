const fetch = require('node-fetch-retry');
const {ServiceTemplate} = require("./ServiceTemplate");
const {Service} = require("./Service");

const refreshDelay = 15;
const serviceTemplates = {
    "ccd": [
        new ServiceTemplate("ccd-data-store-api", env => `http://ccd-data-store-api-${env}.service.core-compute-${env}.internal`),
        new ServiceTemplate("ccd-definition-store-api", env => `http://ccd-definition-store-api-${env}.service.core-compute-${env}.internal`)
    ],
    "xui": [
        new ServiceTemplate("rpx-xui-webapp", env => prodOverride(env, `https://manage-case.platform.hmcts.net`, `https://manage-case.${env}.platform.hmcts.net`))
    ]
}
const services = {
    'AAT': getServices('aat'),
    'PERFTEST': getServices('perftest'),
    'ITHC': getServices('ithc'),
    'DEMO': getServices('demo'),
    'PROD': getServices('prod')
}

function prodOverride(env, prodUrl, defaultTemplateUrl) {
    return env == 'prod' ? prodUrl : defaultTemplateUrl;
}

function getAllServiceStatus() {
    return services;
}

function getServices(env) {
    const resolvedServices = []; 

    Object.entries(serviceTemplates).forEach(([product, templates]) => {
        templates.forEach(template => {
            resolvedServices.push(new Service(template.name, template.getUrl(env)));
        })
    })

    return resolvedServices;
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