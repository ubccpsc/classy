import Log from "./Log";
import Container from "./Container";
import * as dotenv from "dotenv";
import * as fs from "fs-extra";
import { IRuntime } from "./Container";
import DeliverableFactory from "./deliverables/DeliverableFactory";

//require('dotenv').config();
dotenv.config();

/**
 * Exit code:
 *   - 1 Error initializing or terminating container logic.
 */



(async () => {
    const runtimeConfig: string = `${process.env.IO_DIR}/docker_SHA.json`;
    let runtime: IRuntime;
    let container: Container;
    try {
        runtime = await fs.readJson(runtimeConfig);
        container = new Container(runtime);
    } catch (err) {
        Log.error(`Failed to read runtime configuration file ${runtimeConfig}. ${err}`);
        process.exit(1);
    }

    const isFork: any = process.env.IS_FORK;
    Log.trace(`Container isForked ${isFork}`);
    if (isFork) {
        // Run as child process to do the grading
        const deliverable = container.runtime.deliverableInfo.deliverableToMark;
        const deliv = DeliverableFactory.getDeliverable(deliverable, container);
        const runReport = await deliv.run();
        const record = await container.generateRecord(runReport);
        await container.sendRecord(record);
    } else {
        let code: number;
        try {
            await container.init();
        } catch (err) {
            Log.error(`Failed to initialize the container. ${err}`);
            process.exit(1);
        }

        try {
            code = await container.run();
        } catch (err) {
            code = err;
        } finally {
            if (code === 0) {
                Log.info(`Container ran successfully.`);
            } else {
                Log.error(`There was an error running the container. Container exit code ${code}.`);
                process.exit(code);
            }
        }

    }
})();
