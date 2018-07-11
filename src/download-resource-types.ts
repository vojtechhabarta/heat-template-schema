#!/usr/bin/env node
// This CLI script downloads resource type definitions from running OpenStack instance.

import * as fs from "fs";
import axios, { AxiosInstance } from "axios";

main().then(
    () => {
        console.log("Done.");
    },
    (reason: any) => {
        console.error(reason && reason.message || typeof reason === "string" && reason || JSON.stringify(reason, undefined, 2));
        if (reason && reason.response && reason.response.data) {
            console.error(reason.response.data);
        }
    });

async function main() {
    if (process.argv.length < 6) {
        throw new Error("Usage: download-resource-types <output-resource-types-file> <openstack-keystone-url> <username> <password> [projectId]");
    }
    const [, , outputFile, keystoneUrl, username, password, projectId] = process.argv;

    const { axiosInstance, heatUrl } = await login(keystoneUrl, username, password, projectId);
    const resourceTypes = await downloadResourceTypeList(axiosInstance, heatUrl);
    resourceTypes.sort((a, b) => a.resource_type.localeCompare(b.resource_type));

    for (const resourceType of resourceTypes) {
        const resourceInfo = await downloadResourceType(axiosInstance, heatUrl, resourceType.resource_type);
        Object.assign(resourceType, resourceInfo);
    }

    const resourceTypesMap: { [key: string]: ResourceTypeItem } = {};
    resourceTypes.forEach(resourceType => {
        resourceTypesMap[resourceType.resource_type] = resourceType;
        delete resourceType.resource_type;
    });
    const definitions = {
        resource_types: resourceTypesMap
    };

    const definitionsString = JSON.stringify(definitions, undefined, 2);
    console.log(`Writing file '${outputFile}'...`);
    fs.writeFileSync(outputFile, definitionsString, "utf8");
}

async function login(keystoneUrl: string, username: string, password: string, projectId?: string) {
    console.log("Login...");
    const axiosInstance: AxiosInstance = axios.create();
    // addLoggingInterceptors(axiosInstance);
    const response = await axiosInstance.post(`${keystoneUrl}/auth/tokens`, {
        "auth": {
            "identity": {
                "methods": [
                    "password"
                ],
                "password": {
                    "user": {
                        "name": username,
                        "domain": {
                            "id": "default"
                        },
                        "password": password
                    }
                }
            },
            "scope": projectId ? { "project": { "id": projectId } } : "unscoped"
        }
    });
    const keystoneToken = response.headers["x-subject-token"];
    console.log("Token: " + keystoneToken);
    axiosInstance.defaults.headers = {
        "X-Auth-Token": keystoneToken
    };
    const catalog = response.data.token.catalog;
    if (!catalog) {
        throw new Error("No service available, try to specify `projectId`.");
    }
    const heatService = catalog.filter((service: any) => service.type === "orchestration")[0];
    const heatEndpoint = heatService.endpoints.filter((endpoint: any) => endpoint.interface === "public")[0];
    const heatUrl = heatEndpoint.url as string;
    return { axiosInstance, heatUrl };
}

async function downloadResourceTypeList(axiosInstance: AxiosInstance, heatUrl: string) {
    console.log("Downloading resource types...");
    const response = await axiosInstance.get(`${heatUrl}/resource_types?with_description=true`);
    const resourceTypes = response.data.resource_types as ResourceTypeItem[];
    console.log("Number of resource types: " + resourceTypes.length);
    return resourceTypes;
}

async function downloadResourceType(axiosInstance: AxiosInstance, heatUrl: string, resourceType: string) {
    console.log("Downloading " + resourceType + "...");
    const response = await axiosInstance.get(`${heatUrl}/resource_types/${resourceType}`);
    return response.data;
}

function addLoggingInterceptors(axios: AxiosInstance) {
    const requestInterceptor = axios.interceptors.request.use((config) => {
        console.log((config.method && config.method.toUpperCase()) + " " + config.url);
        return config;
    }, (error) => {
        return Promise.reject(error);
    });
    const responseInterceptor = axios.interceptors.response.use((response) => {
        return response;
    }, (error) => {
        return Promise.reject(error);
    });
    return { requestInterceptor, responseInterceptor };
}
