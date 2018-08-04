import Server from "./server/Server";

(async () => {
    const s = new Server();
    s.setPort(Number(process.env.GRADER_PORT));
    await s.start();
    console.log("Running")
})();
