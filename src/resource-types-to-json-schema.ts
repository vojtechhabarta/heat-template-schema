// This CLI script converts resource types to JSON schema.

import * as fs from "fs";

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
    if (process.argv.length < 4) {
        throw new Error("Usage: node lib/resource-types-to-json-schema.js <input-resource-types-file> <output-schema-file>");
    }
    const [, , inputFile, outputFile] = process.argv;

    console.log(`Reading file '${inputFile}'...`);
    const input = fs.readFileSync(inputFile, "utf8");
    const json = JSON.parse(input);
    const schema = resourceTypesToJsonSchema(json.resource_types);
    const schemaString = JSON.stringify(schema, undefined, 2);
    console.log(`Writing file '${outputFile}'...`);
    fs.writeFileSync(outputFile, schemaString, "utf8");
}

export function resourceTypesToJsonSchema(resourceTypes: { [key: string]: ResourceType }): JsonSchema {
    const templateFragment = require("../fragment/fragment-template") as JsonSchema;
    const resourceFragment = require("../fragment/fragment-resource") as JsonSchema;

    const resourcesSchema = templateFragment.properties!["resources"].additionalProperties as JsonSchema;
    resourcesSchema.oneOf = [];

    for (const resourceTypeName of Object.keys(resourceTypes)) {
        const resourceType = resourceTypes[resourceTypeName];
        const resource = JSON.parse(JSON.stringify(resourceFragment)) as JsonSchema;
        const resourceSchema = resource.allOf![0];
        const typeProperty = resourceSchema.properties!["type"];
        const enumArray = typeProperty.enum!;
        enumArray.push(resourceTypeName);

        let description = "";
        if (resourceType.description) {
            description += processDescription(resourceType.description);
        }
        description += renderList("Properties", resourceType.properties);
        description += renderList("Output Attributes", resourceType.attributes);
        description = description.trim();
        if (description) {
            typeProperty.description = description;
        }

        if (resourceType.properties) {
            const x = createObjectSchema(resourceType.properties);
            (resourceSchema.properties as JsonSchemaMap)["properties"] = x;
        }

        resourcesSchema.oneOf.push(resource);
    }

    return templateFragment;
}

function createObjectSchema(object: Properties): JsonSchema {
    const properties: JsonSchemaMap = {};
    const required: string[] = [];
    for (const propertyName of Object.keys(object)) {
        const definition = object[propertyName];
        properties[propertyName] = createPropertySchema(definition);
        if (definition.required) {
            required.push(propertyName);
        }
    }
    return {
        type: "object",
        properties,
        required: required ? required : undefined,
        additionalProperties: false
    };
}

function createPropertySchema(definition: Property): JsonSchema {
    const property: JsonSchema = {};
    let description = "";
    if (definition.description) {
        description += processDescription(definition.description) + "\n";
    }
    if (definition.type) {
        description += "type: " + definition.type + "\n";
    }
    if (definition.required) {
        description += "required: true\n";
    }
    if (definition.default) {
        description += "default: " + JSON.stringify(definition.default, undefined, 4) + "\n";
    }
    if (definition.update_allowed) {
        description += "update_allowed: true\n";
    }
    if (definition.immutable) {
        description += "immutable: true\n";
    }
    description = description.trim();
    if (description) {
        property.description = description;
    }
    if (definition.type) {
        let propertySchema: JsonSchema;
        if (definition.type === "list" && definition.schema && definition.schema["*"]) {
            const itemDefinition = definition.schema["*"];
            propertySchema = {
                type: getSchemaType(definition.type),
                items: createPropertySchema(itemDefinition)
            };
        } else if (definition.type === "list") {
            propertySchema = { "$ref": "#/definitions/array-with-intrinsic-functions" };
        } else if (definition.type === "map" && definition.schema && definition.schema["*"]) {
            const valueDefinition = definition.schema["*"];
            propertySchema = {
                type: getSchemaType(definition.type),
                additionalProperties: createPropertySchema(valueDefinition)
            };
        } else if (definition.type === "map" && definition.schema) {
            propertySchema = createObjectSchema(definition.schema);
        } else if (definition.type === "map") {
            propertySchema = { "$ref": "#/definitions/object-with-intrinsic-functions" };
        } else {
            propertySchema = {
                type: getSchemaType(definition.type)
            };
        }
        property.oneOf = [
            propertySchema,
            { "$ref": "#/definitions/intrinsic-function" }
        ];
    }
    return property;
}

function renderList(heading: string, list?: { [name: string]: (Property | Attribute) }): string {
    let result = "";
    if (list) {
        // const properties = resourceType.properties;
        result += "\n";
        result += heading + ":\n";
        result += Object.keys(list).sort()
            .map(name => {
                const item = list[name];
                return "* "
                    + name
                    + (item.type ? ": " + item.type : "")
                    + (item.description ? " - " + item.description : "");
            })
            .join("\n");
        result += "\n";
    }
    return result;
}

function processDescription(description: string) {
    // TODO remove markdown
    return description.replace(/(\n\n)|(\n)/g, (match) => match === "\n\n" ? "\n" : " ").trim();
}

function getSchemaType(type: Type): string {
    switch (type) {
        case "string": return "string";
        case "integer": return "integer";
        case "number": return "number";
        case "boolean": return "boolean";
        case "list": return "array";
        case "map": return "object";
    }
}
