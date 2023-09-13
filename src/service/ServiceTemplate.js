function ServiceTemplate(name, urlFunction, exclusiveEnvs = []) {
    this.name = name;
    this.urlFunction = urlFunction;
    this.exclusiveEnvs = exclusiveEnvs;
}

ServiceTemplate.prototype.getUrl = function(env) {
    return this.urlFunction(env);
}

ServiceTemplate.prototype.existsInEnv = function(env) {
    return this.exclusiveEnvs.length === 0 || this.exclusiveEnvs.includes(env);
}

module.exports.ServiceTemplate = ServiceTemplate;