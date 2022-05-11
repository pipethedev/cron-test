module.exports = {
  apps: [
    {
      name: "poc-proxy",
      script: "index.js",
      watch: true,
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
