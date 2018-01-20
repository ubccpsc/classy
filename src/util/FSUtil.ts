import * as fs from "fs-extra";
import * as JSZip from "jszip";
import * as path from "path";

/**
 * A collection of utility functions for working with files.
 */
export default class FSUtil {

    /**
     * Creates a Uint8Array of a zip archive containing the deflated file.
     * @param filename The path of the file to zip.
     * @param name The name to give to the file in the zip archive. Defaults to the name of the file.
     */
    public static async zipFile(filename: string, name?: string): Promise<Uint8Array> {
        const zip = new JSZip();
        const zipOptions: JSZip.JSZipGeneratorOptions = {
            compression: "DEFLATE",
            compressionOptions: { level: 9 },
            type: "uint8array",
        };

        if (typeof name === `undefined`) {
            name = path.basename(filename);
        }
        const data: Promise<Buffer> = fs.readFile(filename);
        zip.file(name, data);

        return zip.generateAsync(zipOptions) as Promise<Uint8Array>;
    }

    private constructor() {
        // Do nothing
    }
}
