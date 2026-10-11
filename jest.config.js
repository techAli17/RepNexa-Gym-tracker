module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    // The preset's resolver ignores package "exports"; point at the mock's CommonJS build.
    '^react-native-nitro-sqlite/mock$':
      '<rootDir>/node_modules/react-native-nitro-sqlite/lib/commonjs/mock.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
};
