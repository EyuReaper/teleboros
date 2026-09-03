import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  react: false,
  ignores: ['.next/**', 'next-env.d.ts', 'docs/**', 'public/feed/**', '*.md'],
  rules: {
    'no-console': ['error', { allow: ['info', 'warn', 'error'] }],
  },
})
