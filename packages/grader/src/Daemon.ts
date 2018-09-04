import Server from "./server/Server";

// tslint:disable-next-line
(async () => {
    const s = new Server(Number(process.env.GRADER_PORT), "Grader");
    await s.start();
})();
