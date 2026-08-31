const path = require("path");

// read the env so we can copy custom resources (if needed)
require("dotenv").config(
    {path: "../../../.env"}
);

// copy plugin files so they are available to frontend
const CopyPlugin = require("copy-webpack-plugin");

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
                // The plugin's CustomStudentView / CustomAdminView are no longer copied into
                // src/app/plugs; they are resolved from the plugin directory by the "@plugs" alias
                // below. Copying them here and requiring them relatively was a build-order trap: the
                // copy happens during the run that already resolved the require.
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

    // tsc runs before webpack (see package.json / the Dockerfile) and emits .js beside each
    // .ts, so webpack bundles the compiled output. TypeScript 7 dropped the JS compiler API
    // that ts-loader and tsconfig-paths-webpack-plugin are built on, so neither can run here.
    entry: {
        portal: "./src/app/App.js"
    },

    output: {
        path: path.resolve(__dirname, "./html/js/"),
        publicPath: path.resolve(__dirname, "./html/js/"),
        filename: "portal.js"
    },

    // Enable sourcemaps for debugging webpack"s output.
    devtool: "source-map",

    resolve: {
        extensions: [".js", ".json"],
        // Mirrors the "paths" mappings in tsconfig.json, resolved against the emitted .js
        alias: {
            "@frontend": path.resolve(__dirname, "./src/app"),
            "@common": path.resolve(__dirname, "../../common/src"),
            "@backend": path.resolve(__dirname, "../../portal/backend/src"),

            // The course plugin's frontend, resolved where it actually lives.
            //
            // This used to be a relative require of ./src/app/plugs, a directory CopyPlugin
            // fills in during this same webpack run -- so on a build where it did not already exist
            // (a fresh checkout, which is every Docker build) webpack resolved the require before the
            // copy happened and emitted a module that throws "Cannot find module" at runtime. The
            // admin view silently fell back to the default one; the student view has no fallback, so
            // every student got an empty page. Resolving the plugin directly removes the ordering
            // problem: there is nothing to copy first.
            "@plugs": path.resolve(__dirname, "../../../plugins/" + process.env.PLUGIN + "/portal/frontend")
        }
    },

    performance: {
        hints: false
    },

    module: {
        rules: [
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
