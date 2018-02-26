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

        if (typeof name === "undefined") {
            name = path.basename(filename);
        }
        const data: Promise<string> = fs.readFile(filename, "utf8");
        zip.file(name, data);

        return zip.generateAsync(zipOptions) as Promise<Uint8Array>;
    }

    /**
     * Zips a file and stores it at the destination.
     * @param file The path to the file to zip.
     * @param dest The destination directory to store the zip. If the destination does not exist, it will be created.
     */
    public static async zipTo(file: string, dest: string): Promise<Uint8Array> {
        const filename: string = path.basename(file);
        const zipContent: Uint8Array = await FSUtil.zipFile(file);
        await fs.writeFile(`${dest}/${filename}.zip`, zipContent);
        return zipContent;
    }

    private constructor() {
        // Do nothing
    }
}
