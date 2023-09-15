const {Service} = require("./Service");

const PROD = 'prod';
const AAT = 'aat';
const DEMO = 'demo';
const PERFTEST = 'perftest';
const ITHC = 'ithc';

function Product(name, serviceTemplates) {
    this.name = name;
    this.services = processServiceTemplates(serviceTemplates);
}

function processServiceTemplates(serviceTemplates) {
    const services = {
        [AAT]: getServices(AAT, serviceTemplates),
        [PERFTEST]: getServices(PERFTEST, serviceTemplates),
        [ITHC]: getServices(ITHC, serviceTemplates),
        [DEMO]: getServices(DEMO, serviceTemplates),
        [PROD]: getServices(PROD, serviceTemplates)
    }

    return services;
}

function getServices(env, serviceTemplates) {
    const resolvedServices = [];
    
    serviceTemplates.forEach(template => {
        if (template.existsInEnv(env)){
            resolvedServices.push(new Service(template.name, template.getUrl(env), ''));
        }
    });

    return resolvedServices;
}

Product.prototype.getMarkdown = function (env) {
    const mdStrings = [];
    const ticks = [];
    const crosses = [];

    mdStrings.push(`*${this.name.toUpperCase()}*\n`);
    this.services[env].forEach(service => {
        if (service.isAvailable()) {
            ticks.push(service);
        } else {
            crosses.push(service);
        }
    });

    mdStrings.push(`>:white_check_mark:   ${ticks.length == 0 ? 'None :crycat:' : ticks.map(service => service.getMarkdownLink()).join(', ')}\n\n`);
    mdStrings.push(`>:x:   ${crosses.length == 0 ? 'None :tada:' : crosses.map(service => service.getMarkdownLink()).join(', ')}`);        
    mdStrings.push(`\n\n`)

    return mdStrings.join('');
}

module.exports.Product = Product;