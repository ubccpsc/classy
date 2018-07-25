import Server from "./server/Server";

(async () => {
    const s = new Server();
    s.setPort(3000);
    await s.start();
    console.log("Running")
})();
