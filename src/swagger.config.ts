/**
 * OpenAPI spec is maintained in src/swagger-output.json
 * Run: npm run generate-swagger  (copies spec to build on compile)
 *
 * When adding new endpoints, update src/swagger-output.json directly.
 */
import fs from "fs";
import path from "path";

const specPath = path.join(__dirname, "swagger-output.json");
const buildPath = path.join(__dirname, "../build/swagger-output.json");

if (fs.existsSync(specPath)) {
  console.log("Swagger spec ready at src/swagger-output.json");
  if (fs.existsSync(path.dirname(buildPath))) {
    fs.copyFileSync(specPath, buildPath);
    console.log("Copied to build/swagger-output.json");
  }
} else {
  console.error("swagger-output.json not found");
  process.exit(1);
}
