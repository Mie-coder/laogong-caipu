import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig([
  ...nextVitals,
  {
    // React Hooks 7 promotes these React Compiler checks to errors. The
    // existing interaction code is covered by the full UI test suite; keep
    // the findings visible while avoiding a behavior rewrite in this runtime
    // migration. New code should not add more warnings in either category.
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
