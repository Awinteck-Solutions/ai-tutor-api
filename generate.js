const fs = require("fs");
const path = require("path");

const args = process.argv;
const nameIndex = args.indexOf("-n");

if (nameIndex === -1 || !args[nameIndex + 1]) {
  console.error("Usage: node generate -n <moduleName>");
  process.exit(1);
}

const nameFolder = args[nameIndex + 1];
const basePath = path.join(__dirname, "src/Features", nameFolder);
const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
const Name = capitalize(nameFolder);

const folders = [
  "controllers",
  "services",
  "models",
  "dto",
  "validators",
  "routes",
  "enums",
];

const files = {
  controllers: {
    name: `${nameFolder}.controller.ts`,
    content: `import { Request, Response } from "express";
import { ApiResponse } from "../../../shared/utils/apiResponse";
import { ${Name}Service } from "../services/${nameFolder}.service";

export class ${Name}Controller {
  static async list(req: Request, res: Response): Promise<Response> {
    const result = await ${Name}Service.list(req.query);
    return ApiResponse.success(res, result, "${Name} items retrieved");
  }
}
`,
  },
  services: {
    name: `${nameFolder}.service.ts`,
    content: `import ${Name} from "../models/${nameFolder}.model";

export class ${Name}Service {
  static async list(_query: Record<string, unknown>) {
    const items = await ${Name}.find().sort({ createdAt: -1 });
    return { items };
  }
}
`,
  },
  models: {
    name: `${nameFolder}.model.ts`,
    content: `import mongoose, { Document, Schema } from "mongoose";
import { Status } from "../../../shared/enums/status.enum";

export interface I${Name} extends Document {
  name: string;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
}

const ${nameFolder}Schema = new Schema<I${Name}>(
  {
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(Status),
      default: Status.ACTIVE,
    },
  },
  { timestamps: true }
);

const ${Name} = mongoose.model<I${Name}>("${Name}", ${nameFolder}Schema);
export default ${Name};
`,
  },
  dto: {
    name: `${nameFolder}.dto.ts`,
    content: `export interface Create${Name}Input {
  name: string;
}
`,
  },
  validators: {
    name: `${nameFolder}.validator.ts`,
    content: `import { body } from "express-validator";

export const create${Name}Validator = [
  body("name").trim().notEmpty().withMessage("Name is required"),
];
`,
  },
  routes: {
    name: `${nameFolder}.routes.ts`,
    content: `import { Router } from "express";
import { authenticate } from "../../../middlewares/authentication.middleware";
import { validate } from "../../../middlewares/validation.middleware";
import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { ${Name}Controller } from "../controllers/${nameFolder}.controller";
import { create${Name}Validator } from "../validators/${nameFolder}.validator";

const router = Router();

router.get("/", authenticate, asyncHandler(${Name}Controller.list));

export default router;
`,
  },
  enums: {
    name: `${nameFolder}.enum.ts`,
    content: `export enum ${Name}Type {
  DEFAULT = "DEFAULT",
}
`,
  },
};

function generateFeatureModule() {
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
    console.log(`Created: Features/${nameFolder}`);
  }

  folders.forEach((folder) => {
    const folderPath = path.join(basePath, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }

    const filePath = path.join(folderPath, files[folder].name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, files[folder].content);
      console.log(`Created: ${filePath}`);
    }
  });

  console.log(`Feature module '${nameFolder}' generated. Register route in src/routes/all.routes.ts`);
}

generateFeatureModule();
