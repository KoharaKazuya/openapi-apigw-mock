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
  const { json: data, dereferenced, format: inputFormat } = await parse(input);

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
        if (isPathDefined(response, "content.application/json.example")) {
          exampleStatusCode = statusCode;
          exampleBody = response.content["application/json"].example;
          break;
        }
        if (
          isPathDefined(response, "content.application/json.examples") &&
          Object.keys(response.content["application/json"].examples).length > 0
        ) {
          exampleStatusCode = statusCode;
          exampleBody =
            response.content["application/json"].examples[
              Object.keys(response.content["application/json"].examples)[0]
            ];
          break;
        }
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
          default: {
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": "'*'"
            },
            ...(exampleBody === undefined
              ? {
                  statusCode: String(responseStatusCode || "200")
                }
              : {
                  statusCode: String(exampleStatusCode),
                  responseTemplates: {
                    "application/json": JSON.stringify(exampleBody)
                  }
                })
          }
        }
      };
    }
  }

  setCORS(data);

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
 * @param {string} text
 * @return {Promise<{ json: any, format: 'json' | 'yaml', dereferenced: any }>}
 */
async function parse(text) {
  let data;
  let format;
  try {
    data = JSON.parse(text);
    format = "json";
  } catch (e) {
    data = yaml.safeLoad(text);
    format = "yaml";
  }

  const dereferenced = JSON.parse(JSON.stringify(data)); // json copy
  await SwaggerParser.dereference(dereferenced);

  return { json: data, format, dereferenced };
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

function setCORS(data) {
  // add Access-Control-Allow-Origin header to all responses
  for (const path of Object.keys(data.paths)) {
    const pathObj = data.paths[path];
    for (const method of Object.keys(pathObj)) {
      if (!methods.includes(method)) continue;

      const operationObj = pathObj[method];
      for (const statusCode of Object.keys(operationObj.responses)) {
        const response = operationObj.responses[statusCode];
        if (response.$ref) continue;
        if (!response.headers) response.headers = {};
        response.headers["Access-Control-Allow-Origin"] = {
          schema: { type: "string" }
        };
      }
    }
  }
  if (isPathDefined(data, "components.responses")) {
    for (const responseName of Object.keys(data.components.responses)) {
      const response = data.components.responses[responseName];
      if (response.$ref) continue;
      if (!response.headers) response.headers = {};
      response.headers["Access-Control-Allow-Origin"] = {
        schema: { type: "string" }
      };
    }
  }

  // add options method to all paths
  for (const path of Object.keys(data.paths)) {
    const pathObj = data.paths[path];

    pathObj.options = {
      responses: {
        "200": {
          description: "200 response",
          headers: {
            "Access-Control-Allow-Origin": { schema: { type: "mock" } },
            "Access-Control-Allow-Methods": { schema: { type: "mock" } },
            "Access-Control-Allow-Headers": { schema: { type: "mock" } }
          }
        }
      },
      "x-amazon-apigateway-integration": {
        type: "mock",
        requestTemplates: {
          "application/json": '{"statusCode":200}'
        },
        responses: {
          default: {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Methods": `'${methods
                .map(m => m.toUpperCase())
                .join(",")}'`,
              "method.response.header.Access-Control-Allow-Headers":
                "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
              "method.response.header.Access-Control-Allow-Origin": "'*'"
            }
          }
        }
      }
    };
  }
}

module.exports = {
  convert
};
