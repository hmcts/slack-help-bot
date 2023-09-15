const fetch = require('node-fetch-retry');
const {ServiceTemplate} = require("./ServiceTemplate");
const {Product} = require("./Product");

const PROD = 'prod';
const AAT = 'aat';
const DEMO = 'demo';
const PERFTEST = 'perftest';
const ITHC = 'ithc';

const refreshDelay = 60;
const products = [
    new Product("aac",[
        new ServiceTemplate("manage-case-assignment", env => `http://aac-manage-case-assignment-${env}.service.core-compute-${env}.internal`),
    ]),
    new Product("am", [
        new ServiceTemplate("am-judicial-booking-service", env => `http://am-judicial-booking-service-${env}.service.core-compute-${env}.internal`),
        new ServiceTemplate("am-org-role-mapping-service", env => `http://am-org-role-mapping-service-${env}.service.core-compute-${env}.internal`),
        new ServiceTemplate("am-role-assignment-service", env => `http://am-role-assignment-service-${env}.service.core-compute-${env}.internal`)
    ]),
    new Product("ccd", [
        new ServiceTemplate("ccd-admin-web", env => prodOverride(env, `https://ccd-admin-web.platform.hmcts.net`, `https://ccd-admin-web.${env}.platform.hmcts.net`)),
        new ServiceTemplate("ccd-api-gateway-web", env => prodOverride(env, `https://gateway.ccd.platform.hmcts.net`, `https://gateway-ccd.${env}.platform.hmcts.net`)),
        new ServiceTemplate("ccd-case-activity-api", env => `http://ccd-case-activity-api-${env}.service.core-compute-${env}.internal`),
        new ServiceTemplate("ccd-case-document-am-api", env => `http://ccd-case-document-am-api-${env}.service.core-compute-${env}.internal`),
        new ServiceTemplate("ccd-case-print-service", env => prodOverride(env, `https://return-case-doc.ccd.platform.hmcts.net`, `https://return-case-doc-ccd.${env}.platform.hmcts.net`)),
        new ServiceTemplate("ccd-data-store-api", env => `http://ccd-data-store-api-${env}.service.core-compute-${env}.internal`),
        new ServiceTemplate("ccd-definition-store-api", env => `http://ccd-definition-store-api-${env}.service.core-compute-${env}.internal`),
        new ServiceTemplate("ccd-message-publisher", env => `http://ccd-message-publisher-${env}.service.core-compute-${env}.internal`),
        new ServiceTemplate("ccd-test-stubs-service", env => `http://ccd-test-stubs-service-${env}.service.core-compute-${env}.internal`, [ DEMO, AAT, ITHC, PERFTEST ]),
        new ServiceTemplate("ccd-user-profile-api", env => `http://ccd-user-profile-api-${env}.service.core-compute-${env}.internal`),
    ]),
    new Product("cpo", [
        new ServiceTemplate("case-payment-orders-api", env => `http://cpo-case-payment-orders-api-${env}.service.core-compute-${env}.internal`)
    ]),
    new Product("em", [
        new ServiceTemplate("dg-docassembly", env => `http://dg-docassembly-${env}.service.core-compute-${env}.internal`),
        new ServiceTemplate("dm-store", env => `http://dm-store-${env}.service.core-compute-${env}.internal`),
        new ServiceTemplate("em-anno", env => `http://em-anno-prod.service.core-compute-prod.internal`),
        new ServiceTemplate("em-ccd-orchestrator", env => `http://em-ccd-orchestrator-prod.service.core-compute-prod.internal`),
        new ServiceTemplate("em-hrs-api", env => `http://em-hrs-api-prod.service.core-compute-prod.internal`),
        new ServiceTemplate("em-npa", env => `http://em-npa-prod.service.core-compute-prod.internal`),
        new ServiceTemplate("em-stitching", env => `http://em-stitching-prod.service.core-compute-prod.internal`),
    ]),
    new Product("fees-pay", [

    ]),
    new Product("hmc", [

    ]),
    new Product("idam", [

    ]),
    new Product("lau", [

    ]),
    new Product("pcq", [

    ]),
    new Product("rd", [

    ]),
    new Product("ts", [

    ]),
    new Product("wa", [

    ]),
    new Product("xui", [
        new ServiceTemplate("xui-webapp", env => prodOverride(env, `https://manage-case.platform.hmcts.net`, `https://manage-case.${env}.platform.hmcts.net`)),
        new ServiceTemplate("xui-webapp-hearings-integration", () => `https://manage-case-hearings-int.demo.platform.hmcts.net`, [ DEMO ]),
    ])
];

function prodOverride(env, prodUrl, defaultTemplateUrl) {
    return env === PROD ? prodUrl : defaultTemplateUrl;
}

function getAllProducts() {
    return products;
}

function monitorProductStatus() { 
    // TODO: Only bother running reporting checks if current time is during expected cluster running hours
    products.forEach(product => {
        Object.entries(product.services).forEach(([env, services]) => {
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
        });
    })
}

monitorProductStatus();
setInterval(monitorProductStatus, refreshDelay * 1000)

module.exports.getAllProducts = getAllProducts;
