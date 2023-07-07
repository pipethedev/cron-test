module.exports = {
  apps: [
    {
      name: "uptime",
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
