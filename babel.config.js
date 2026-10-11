module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // zod v4 ships `export * as ns from` in its ESM build.
  plugins: ['@babel/plugin-transform-export-namespace-from'],
};
