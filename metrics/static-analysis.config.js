// ESLint config for static analysis: the SonarJS recommended rules.
// Separate from complexity.config.js, which only reports complexity values.
const sonarjs = require('eslint-plugin-sonarjs');

module.exports = [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    ...sonarjs.configs.recommended,
  },
];
