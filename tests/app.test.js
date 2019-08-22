const fs = require("fs");
const path = require("path");
const util = require("util");
const { convert } = require("../app.js");

describe("convert from input into expected output", () => {
  const fileNames = fs.readdirSync(path.join(__dirname, "data"));
  for (const fileName of fileNames) {
    if (fileName.startsWith(".")) continue;

    it(`converts from ${fileName}`, async () => {
      const readFileAsync = path =>
        util.promisify(fs.readFile)(path, { encoding: "utf8" });
      const input = await readFileAsync(path.join(__dirname, "data", fileName));
      expect(await convert(input)).toMatchSnapshot();
    });
  }
});
