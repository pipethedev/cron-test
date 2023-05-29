module.exports = {
  apps: [
    {
      name: "poc-proxy",
      script: "./dist/index.js",
      watch: "./dist",
      env_production: {
        NODE_ENV: "production",
      },
      ignore: ["node_modules"],
      max_memory_restart: "1G",
    },
  ],
};
