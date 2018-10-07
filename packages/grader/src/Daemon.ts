import Server from "./server/Server";

// tslint:disable-next-line
(async () => {
    const s = new Server("Grader");
    await s.start(Number(process.env.GRADER_PORT));
})();
