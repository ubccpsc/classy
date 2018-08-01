import Server from "./server/Server";

(async () => {
    const s = new Server(Number(process.env.GRADER_PORT), "Grader");
    await s.start();
})();
