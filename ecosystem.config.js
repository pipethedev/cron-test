module.exports = {
  apps: [
    {
      name: "poc-proxy",
      script: "./dist/index.js",
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
