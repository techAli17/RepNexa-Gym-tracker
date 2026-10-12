module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // `void promise` marks deliberate fire-and-forget calls whose errors are handled inside.
    'no-void': 'off',
    // Navigation render props (tabBarIcon, headerRight) are the library's intended pattern.
    'react/no-unstable-nested-components': ['warn', { allowAsProps: true }],
  },
};
