const AWS = require("aws-sdk");

async function deploy({ body, restApiId, stageName = "v0" } = {}) {
  const apigw = new AWS.APIGateway({ apiVersion: "2015-07-09" });

  let operation;
  if (!restApiId) {
    // create
    operation = "create";
    const restApi = await new Promise((resolve, reject) => {
      apigw.importRestApi({ body, failOnWarnings: true }, (err, data) =>
        err ? reject(err) : resolve(data)
      );
    });
    restApiId = restApi.id;
  } else {
    // update
    operation = "update";
    const restApi = await new Promise((resolve, reject) => {
      apigw.putRestApi(
        {
          restApiId,
          body,
          failOnWarnings: true,
          mode: "overwrite"
        },
        (err, data) => (err ? reject(err) : resolve(data))
      );
    });
  }

  // deploy
  const deploy = await new Promise((resolve, reject) => {
    apigw.createDeployment({ restApiId, stageName }, (err, data) =>
      err ? reject(err) : resolve(data)
    );
  });

  const region = AWS.config.region;
  const endpoint = `https://${restApiId}.execute-api.${region}.amazonaws.com/${stageName}/`;

  return { operation, restApiId, endpoint };
}

module.exports = { deploy };
