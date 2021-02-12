.DEFAULT_GOAL := all
CHART := charts
RELEASE := chart-slack-help-bot-release
NAMESPACE := admin
TEST := ${RELEASE}-test-service
ACR := hmctspublic
ACR_SUBSCRIPTION := DCD-CNP-Prod
AKS_SUBSCRIPTION := DTS-CFTPTL-INTSVC
AKS_RESOURCE_GROUP := cftptl-intsvc-00-rg
AKS_CLUSTER := cftptl-intsvc-00-aks

build-push:
	docker build . -t slack-help-bot
	docker tag slack-help-bot hmctspublic.azurecr.io/rpe/slack-help-bot:test-1
	docker push hmctspublic.azurecr.io/rpe/slack-help-bot:test-1

setup-acr:
	az account set --subscription ${ACR_SUBSCRIPTION}
	az configure --defaults acr=${ACR}
	az acr helm repo add

login-acr:
	az acr login ${ACR}

setup-aks:
	az account set --subscription ${ACR_SUBSCRIPTION}
	az aks get-credentials --resource-group ${AKS_RESOURCE_GROUP} --name ${AKS_CLUSTER}

clean:
	-helm uninstall ${RELEASE} -n ${NAMESPACE}

lint:
	helm lint ${CHART} -f ci-values.yaml

template:
	helm template ${CHART} -f ci-values.yaml

deploy:
	helm install ${RELEASE} ${CHART}  --namespace ${NAMESPACE} -f ci-values.yaml --wait --timeout 60s

dry-run:
	helm dependency update ${CHART} 
	helm install ${RELEASE} ${CHART}  --namespace ${NAMESPACE} -f ci-values.yaml --dry-run --debug

test:
	helm test ${RELEASE}

all: setup clean lint deploy test

drytestrelease: build-push dry-run

testrelease: build-push deploy

.PHONY: setup clean lint deploy test all