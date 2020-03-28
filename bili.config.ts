import { Config } from "bili";

const config: Config = {
  input: "src/index.ts",
  babel: {
    minimal: true
  },
  output: {
    fileName: "index.js",
    format: ["cjs"],
    moduleName: "smart-diff"
  },
  plugins: {
    typescript2: {
      tsconfigOverride: {
        include: ["src"]
      }
    }
  }
};

export default config;
