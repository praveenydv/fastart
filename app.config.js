module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL || (process.env.GITHUB_ACTIONS ? "/fastart" : "");

  return {
    ...config,
    experiments: {
      ...config.experiments,
      ...(baseUrl ? { baseUrl } : {}),
    },
  };
};
