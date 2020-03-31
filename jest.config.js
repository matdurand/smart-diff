module.exports = {
    testEnvironment: "node",
    transform: {
        "^.+\\.tsx?$": "ts-jest"
    },
    setupFiles: ["core-js"],
    testRegex: "(/__test__/.*|(\\.|/)(test|spec))\\.tsx?$",
    testPathIgnorePatterns: ["/node_modules/", "/dist/", "/types/"],
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    setupFilesAfterEnv: ["jest-expect-message"],
    coverageThreshold: {
        global: {
            branches: 100,
            functions: 100,
            lines: 100,
            statements: 100
        }
    }
};
