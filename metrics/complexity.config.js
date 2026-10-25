// ESLint config for measuring complexity (task 3), not for everyday linting.
// The limits are 0 so ESLint reports the value of every function.
const sonarjs = require('eslint-plugin-sonarjs');

module.exports = [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { sonarjs },
    rules: {
      complexity: ['warn', 0],
      'sonarjs/cognitive-complexity': ['warn', 0],
    },
  },
];
