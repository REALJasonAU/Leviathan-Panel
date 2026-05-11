module.exports.register = ({ app }) => {
  app.get("/v1/plugins/hello-world", async () => ({
    ok: true,
    message: "Hello from the trusted Leviathan plugin runtime.",
  }));
};
