function ServiceTemplate(name, urlFunction) {
    this.name = name;
    this.urlFunction = urlFunction;
    this.envs = [];
}

ServiceTemplate.prototype.getUrl = function(env) {
    return this.urlFunction(env);
}

ServiceTemplate.prototype.getName = function() {
    return this.name;
}

module.exports.ServiceTemplate = ServiceTemplate;