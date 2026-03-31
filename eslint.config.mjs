import globals from 'globals';
import pluginJs from '@eslint/js';

export default [
  { files: ['src/**/*.js'], languageOptions: { sourceType: 'commonjs' } },
  { languageOptions: { globals: globals.node } },
  { languageOptions: { globals: globals.jest } },
  pluginJs.configs.recommended,
];
