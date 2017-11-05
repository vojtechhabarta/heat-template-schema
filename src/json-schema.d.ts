
interface JsonSchema {
    description?: string;
    markdownDescription?: string;
    properties?: JsonSchemaMap;
    required?: string[];
    additionalProperties?: boolean | JsonSchema;
    type?: string | string[];
    enum?: any[];
    items?: JsonSchema | JsonSchema[];
    anyOf?: JsonSchema[];
    allOf?: JsonSchema[];
    oneOf?: JsonSchema[];
    $ref?: string;
}

type JsonSchemaMap = { [name: string]: JsonSchema };
