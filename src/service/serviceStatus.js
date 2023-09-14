const fetch = require('node-fetch-retry');
const {ServiceTemplate} = require("./ServiceTemplate");
const {Service} = require("./Service");

const PROD = 'prod';
const AAT = 'aat';
const DEMO = 'demo';
const PERFTEST = 'perftest';
const ITHC = 'ithc';

const refreshDelay = 60;
const serviceTemplates = {
    "ccd": [
        new ServiceTemplate("ccd-admin-web", env => prodOverride(env, `https://ccd-admin-web.platform.hmcts.net`, `https://ccd-admin-web.${env}.platform.hmcts.net`)),
        new ServiceTemplate("ccd-api-gateway-web", env => prodOverride(env, `https://gateway.ccd.platform.hmcts.net`, `https://gateway-ccd.${env}.platform.hmcts.net`)),
        new ServiceTemplate("ccd-case-activity-api", env => `http://ccd-case-activity-api-${env}.service.core-compute-${env}.internal`),
        new ServiceTemplate("ccd-case-document-am-api", env => `http://ccd-case-document-am-api-${env}.service.core-compute-${env}.internal`),
        new ServiceTemplate("ccd-case-print-service", env => prodOverride(env, `https://return-case-doc.ccd.platform.hmcts.net`, `https://return-case-doc-ccd.${env}.platform.hmcts.net`)),
        new ServiceTemplate("ccd-data-store-api", env => `http://ccd-data-store-api-${env}.service.core-compute-${env}.internal`),
        new ServiceTemplate("ccd-definition-store-api", env => `http://ccd-definition-store-api-${env}.service.core-compute-${env}.internal`),
        new ServiceTemplate("ccd-message-publisher", env => `http://ccd-message-publisher-${env}.service.core-compute-${env}.internal`),
        new ServiceTemplate("ccd-test-stubs-service", env => `http://ccd-test-stubs-service-${env}.service.core-compute-${env}.internal`, [ DEMO, AAT, ITHC, PERFTEST ]),
        new ServiceTemplate("ccd-user-profile-api", env => `http://ccd-user-profile-api-${env}.service.core-compute-${env}.internal`)
    ],
    "xui": [
        new ServiceTemplate("xui-webapp", env => prodOverride(env, `https://manage-case.platform.hmcts.net`, `https://manage-case.${env}.platform.hmcts.net`)),
        new ServiceTemplate("xui-webapp-hearings-integration", () => `https://manage-case-hearings-int.demo.platform.hmcts.net`, [ DEMO ])
    ]
}
const services = {
    'AAT': getServices(AAT),
    'PERFTEST': getServices(PERFTEST),
    'ITHC': getServices(ITHC),
    'DEMO': getServices(DEMO),
    'PROD': getServices(PROD)
}

function prodOverride(env, prodUrl, defaultTemplateUrl) {
    return env === PROD ? prodUrl : defaultTemplateUrl;
}

function getAllServiceStatus() {
    return services;
}

function getServices(env) {
    const resolvedServices = []; 

    Object.entries(serviceTemplates).forEach(([namespace, templates]) => {
        templates.forEach(template => {
            if (template.existsInEnv(env)){
                resolvedServices.push(new Service(template.name, template.getUrl(env), namespace));
            }
        })
    })

    return resolvedServices;
}

function monitorStatus() { 
    // TODO: Only bother running checks if current time is during expected cluster running hours
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
// setInterval(monitorStatus, refreshDelay * 1000)

module.exports.getAllServiceStatus = getAllServiceStatus;
