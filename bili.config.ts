import { Config } from "bili";

const config: Config = {
  input: "src/index.ts",
  babel: {
    minimal: true
  },
  output: {
    fileName: "index.js",
    format: ["cjs"],
    moduleName: "smart-differences"
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
