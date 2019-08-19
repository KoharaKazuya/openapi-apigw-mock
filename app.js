const yaml = require("js-yaml");
const SwaggerParser = require("swagger-parser");

const methods = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace"
];

/**
 * @param {string} input
 * @returns {Promise<string>}
 */
async function convert(input) {
  let data;
  let inputFormat;
  try {
    data = JSON.parse(input);
    inputFormat = "json";
  } catch (e) {
    data = yaml.safeLoad(input);
    inputFormat = "yaml";
  }
  const dereferenced = JSON.parse(JSON.stringify(data)); // json copy
  await SwaggerParser.dereference(dereferenced);

  for (const path of Object.keys(dereferenced.paths)) {
    const pathObj = dereferenced.paths[path];
    for (const method of Object.keys(pathObj)) {
      if (!methods.includes(method)) continue;

      const operationObj = pathObj[method];
      let responseStatusCode;
      let exampleStatusCode;
      let exampleBody;
      for (const statusCode of Object.keys(operationObj.responses)) {
        const response = operationObj.responses[statusCode];
        if (!responseStatusCode) responseStatusCode = statusCode;
        if (isPathDefined(response, "content.application/json.schema")) {
          exampleStatusCode = statusCode;
          exampleBody = extractExampleFromJSONSchema(
            response.content["application/json"].schema
          );
          break;
        }
      }
      data.paths[path][method]["x-amazon-apigateway-integration"] = {
        type: "mock",
        requestTemplates: {
          "application/json": '{"statusCode":200}'
        },
        responses: {
          default:
            exampleBody === undefined
              ? {
                  statusCode: String(responseStatusCode)
                }
              : {
                  statusCode: String(exampleStatusCode),
                  responseTemplates: {
                    "application/json": JSON.stringify(exampleBody)
                  }
                }
        }
      };
    }
  }

  switch (inputFormat) {
    case "json":
      return JSON.stringify(data, null, 2);
    case "yaml":
      return yaml.safeDump(data);
    default:
      throw new Error("unknown format: " + inputFormat);
  }
}

/**
 * @param {any} target
 * @param {string} path dot separated keys
 * @return {boolean}
 */
function isPathDefined(target, path) {
  if (target === undefined) return false;
  if (path === "") return true;
  if (typeof target !== "object") return false;

  const keys = path.split(".");
  return isPathDefined(target[keys[0]], keys.slice(1).join("."));
}

/**
 * @param {object} schema JSON Schema object
 * @returns {any} example
 */
function extractExampleFromJSONSchema(schema) {
  if (isPathDefined(schema, "example")) return schema.example;

  switch (schema.type) {
    case "boolean":
      return true;
    case "number":
    case "integer":
      return 0;
    case "string":
      return "";
    case "array":
      if (!isPathDefined(schema, "items")) return [];
      return [extractExampleFromJSONSchema(schema.items)];
    case "object":
      if (!isPathDefined(schema, "properties")) return {};
      return Object.keys(schema.properties).reduce(
        (accu, key) => ({
          ...accu,
          [key]: extractExampleFromJSONSchema(schema.properties[key])
        }),
        {}
      );
    default:
      throw new Error("unknown schema type: " + schema.type);
  }
}

module.exports = {
  convert
};
