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

        typeProperty.description = getResourceTypeDescription(resourceType, false);
        typeProperty.markdownDescription = getResourceTypeDescription(resourceType, true);

        if (resourceType.properties) {
            const x = createObjectSchema(resourceType.properties);
            (resourceSchema.properties as JsonSchemaMap)["properties"] = x;
        }

        resourcesSchema.oneOf.push(resource);
    }

    return templateFragment;

    function getResourceTypeDescription(resourceType: ResourceType, markdown: boolean) {
        let description = (
            processDescription(resourceType.description, markdown) +
            renderList("Properties", resourceType.properties, markdown) +
            renderList("Output Attributes", resourceType.attributes, markdown)
        ).trim();
        return description ? description : undefined;
    }
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
    property.description = getPropertyDescription(definition, false);
    property.markdownDescription = getPropertyDescription(definition, true);
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

    function getPropertyDescription(definition: Property, markdown: boolean) {
        const nl = markdown ? "\n\n" : "\n";
        let description = "";
        if (definition.description) {
            description += processDescription(definition.description, markdown) + nl;
        }
        const infos = [
            info("type", definition.type, markdown),
            info("required", definition.required, markdown),
            info("default", JSON.stringify(definition.default, undefined, 4), markdown),
            info("update_allowed", definition.update_allowed, markdown),
            info("immutable", definition.immutable, markdown),
        ];
        description += infos.filter(info => !!info).join(nl);
        description = description.trim();
        return description ? description : undefined;

        function info(name: string, value: string | boolean | undefined, markdown: boolean) {
            if (!value) {
                return "";
            }
            const valueString = typeof value === "string" ? value : value.toString();
            return italics(name, markdown) + ": " + code(valueString, markdown);
        }
    }
}

function renderList(heading: string, list: { [name: string]: (Property | Attribute) } | undefined, markdown: boolean): string {
    let result = "";
    if (list) {
        result += "\n";
        result += markdown ? "### " + heading : heading;
        result += "\n";
        result += Object.keys(list).sort()
            .map(name => {
                const item = list[name];
                return "* "
                    + bold(name, markdown)
                    + (item.type ? ": " + code(item.type, markdown) : "")
                    + (item.description ? " - " + item.description : "");
            })
            .join("\n");
        result += "\n";
    }
    return result;
}

function processDescription(description: string | undefined, markdown: boolean) {
    if (!description) {
        return "";
    }
    if (markdown) {
        return description;
    } else {
        // TODO remove markdown
        return description.replace(/(\n\n)|(\n)/g, (match) => match === "\n\n" ? "\n" : " ").trim();
    }
}

function bold(text: string | undefined, markdown: boolean): string {
    if (!text) {
        return "";
    }
    return markdown ? "**" + text + "**" : text;
}

function italics(text: string | undefined, markdown: boolean): string {
    if (!text) {
        return "";
    }
    return markdown ? "*" + text + "*" : text;
}

function code(text: string | undefined, markdown: boolean): string {
    if (!text) {
        return "";
    }
    return markdown ? "`" + text + "`" : text;
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
