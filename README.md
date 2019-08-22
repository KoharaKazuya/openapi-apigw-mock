# OpenAPI API Gateway Mock

A command generates mock server on AWS API Gateway from OpenAPI (v3) document quickly.

You can import OpenAPI document without writing [API Gateway extension](https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/api-gateway-swagger-extensions.html). This command uses OpenAPI or JSON Schema example field as mock server responses.
Generated mock server supports CORS.

## Requirements

- Node.js
- OpenAPI Document (OAS v3)
  - support only `application/json` type

## Usage

```console
$ npx openapi-apigw-mock ${OpenAPI document file}
```

or

```console
$ npm install -g openapi-apigw-mock
$ open-apigw-mock ${OpenAPI document file} # deploy to AWS API Gateway
$ open-apigw-mock-convert ${OpenAPI document file} # show the converted OpenAPI document
```
