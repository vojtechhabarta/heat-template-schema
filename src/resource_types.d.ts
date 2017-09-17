
type ResourceTypeItem = { resource_type: string, description?: string };

type ResourceTypes = { [name: string]: ResourceType };

interface ResourceType {
    description?: string;
    support_status?: SupportStatus;
    properties?: Properties;
    attributes?: Attributes;
}

type Type = "string" | "integer" | "number" | "boolean" | "list" | "map";

type Attributes = { [name: string]: Attribute };

interface Attribute {
    type?: Type;
    description?: string;        
}

type Properties = { [name: string]: Property };

interface Property {
    type?: Type;
    description?: string;
    default?: any;
    schema?: Properties;
    required?: boolean;
    constraints?: any[];
    update_allowed?: boolean;
    immutable?: boolean;
}

interface SupportStatus {
    status?: "UNKNOWN" | "SUPPORTED" | "DEPRECATED" | "UNSUPPORTED" | "HIDDEN";
    message?: string | null;
    version?: string | null;
    previous_status?: null;
}
