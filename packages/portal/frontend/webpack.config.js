const path = require("path");

// read the env so we can copy custom resources (if needed)
require("dotenv").config(
    {path: "../../../.env"}
);

// copy plugin files so they are available to frontend
const CopyPlugin = require("copy-webpack-plugin");

// handle @frontend and @common type import aliases from plugin
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
const { webpack, DefinePlugin } = require("webpack");

/**
 * Checks if plugin enabled in .env. Assume there _must_ be custom html as well.
 *
 * @returns {boolean}
 */
 const pluginExists = () => {
    return process.env.PLUGIN ? true : false;
}

console.log("Preparing frontend for: " + process.env.NAME);


if (process.env.PLUGIN !== "default") {
    console.log("Loading plugin: " + process.env.PLUGIN);
} else {
    console.log("Loading Classy defaults...");
}

module.exports = {

    // https://webpack.js.org/concepts/mode/
    mode: "development",

    plugins: [
        new DefinePlugin({
            "process.env.LOG_LEVEL": JSON.stringify(process.env.LOG_LEVEL) || JSON.stringify("INFO")
        }),
        new CopyPlugin({
            patterns: [
                // Copy plugin frontend files if plugin enabled or copy default Classy logic into place
                // Docker and native compilation working dir: /classy/packages/portal/frontend
                // frontend/CustomStudentView.ts, CustomAdminView.ts, with their supporting files,
                // will be moved to their appropriate directories
                //
                // Course-specific plugins should be in classy/plugins/process.env.PLUGIN
                // When run, plugin will be copied to classy/packages/portal/frontend/app/plugs/
                {
                    from: "../../../plugins/" + process.env.PLUGIN + "/portal/frontend/",
                    to: "../../src/app/plugs/",
                    toType: "dir",
                    force: true,
                    noErrorOnMissing: false,
                    force: true
                },
                {
                    from: "../../../plugins/" + process.env.PLUGIN + "/portal/frontend/html",
                    // to: "../html/" + process.env.NAME, // puts it in ./html/{name}
                    to: "../" + process.env.NAME,
                    toType: "dir",
                    noErrorOnMissing: false,
                    force: true
                }
            ],
        }),
    ],

    entry: {
        portal: "./src/app/App.ts"
    },

    output: {
        path: path.resolve(__dirname, "./html/js/"),
        publicPath: path.resolve(__dirname, "./html/js/"),
        filename: "portal.js"
    },

    // Enable sourcemaps for debugging webpack"s output.
    devtool: "source-map",

    resolve: {
        // Add ".ts" and ".tsx" as resolvable extensions.
        extensions: [".ts", ".tsx", ".js", ".json"],
        plugins: [new TsconfigPathsPlugin({
            configFile: "tsconfig.json"
        })]
    },

    performance: {
        hints: false
    },

    module: {
        rules: [
            // All files with a ".ts" or ".tsx" extension will be handled by "ts-loader" or awesome-typescript-loader".
            {test: /\.tsx?$/, loader: "ts-loader"},

            // All output ".js" files will have any sourcemaps re-processed by "source-map-loader".
            {
                enforce: "pre",
                test: /\.js$/,
                loader: "source-map-loader",
                exclude: []
            }
        ]
    }
};
