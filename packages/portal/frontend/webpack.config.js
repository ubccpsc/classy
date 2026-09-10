const path = require("path");
const fs = require("fs");

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

/**
 * Fails the build when PLUGIN does not name a real plugin, or when tsc has not run.
 *
 * webpack bundles emitted .js (see the entry comment below), so if tsc has not run there is
 * nothing to bundle -- but webpack does not say so usefully. Both Custom*View requires in
 * Factory.ts sit inside a try/catch, and webpack downgrades an unresolvable require in a
 * try/catch to a *warning*: it exits 0 and emits a bundle whose require throws at runtime, where
 * the catch logs and leaves the view null. That is the failure that gave every student an empty
 * page. Better to stop here than at 8am.
 *
 * The PLUGIN half of this check used to be implicit: CopyPlugin ran against the plugin's html
 * directory with noErrorOnMissing:false, so a mistyped PLUGIN could not get past the copy. That
 * directory is optional now (a plugin need not override any page), so the check has to be explicit.
 */
const BUILD_FIRST = "run `yarn run build` from the repo root (tsc emits the .js webpack bundles)";

const assertBuilt = () => {
    // the entry itself; missing means tsc has not run over the frontend at all
    const entry = path.resolve(__dirname, "./src/app/App.js");
    if (fs.existsSync(entry) === false) {
        throw new Error("Frontend is not compiled: " + entry + " does not exist -- " + BUILD_FIRST);
    }

    const dir = path.resolve(__dirname, "../../../plugins/" + process.env.PLUGIN + "/portal/frontend");
    if (fs.existsSync(dir) === false) {
        throw new Error("PLUGIN=" + process.env.PLUGIN + " does not exist; no such directory: " + dir);
    }

    for (const view of ["CustomAdminView", "CustomStudentView"]) {
        // .ts is what a plugin ships; .js is what webpack actually resolves, so both matter, and
        // which one is missing says whether this is a broken plugin or an unbuilt tree
        const source = path.join(dir, view + ".ts");
        const emitted = path.join(dir, view + ".js");
        if (fs.existsSync(source) === false && fs.existsSync(emitted) === false) {
            throw new Error("PLUGIN=" + process.env.PLUGIN + " is missing " + view + "; expected it in: " + dir);
        }
        if (fs.existsSync(emitted) === false) {
            throw new Error("Plugin is not compiled: " + emitted + " does not exist -- " + BUILD_FIRST);
        }
    }
};

assertBuilt();

/**
 * Turns "Can't resolve" warnings into build errors.
 *
 * The pre-flight check above only knows about the files it was told to look for. This covers
 * everything else -- a stale emitted file that requires a module tsc has since renamed, a typo in
 * an import, a plugin whose own dependencies are unbuilt -- so that no unresolved module can leave
 * this build with exit 0. webpack reports these as warnings whenever the require sits inside a
 * try/catch, which in this codebase is exactly where the important ones are.
 */
class FailOnUnresolvedModules {
    apply(compiler) {
        compiler.hooks.afterCompile.tap("FailOnUnresolvedModules", (compilation) => {
            const unresolved = compilation.warnings.filter((w) => /Can't resolve/.test(String(w.message)));
            if (unresolved.length === 0) {
                return;
            }
            compilation.warnings = compilation.warnings.filter((w) => unresolved.indexOf(w) === -1);
            for (const warning of unresolved) {
                compilation.errors.push(warning);
            }
        });
    }
}


if (process.env.PLUGIN !== "default") {
    console.log("Loading plugin: " + process.env.PLUGIN);
} else {
    console.log("Loading Classy defaults...");
}

module.exports = {

    // https://webpack.js.org/concepts/mode/
    mode: "development",

    plugins: [
        new FailOnUnresolvedModules(),
        new DefinePlugin({
            "process.env.LOG_LEVEL": JSON.stringify(process.env.LOG_LEVEL) || JSON.stringify("INFO")
        }),
        new CopyPlugin({
            // The served page directory (html/{NAME}) is built in two layers: Classy's own pages
            // first, then the plugin's on top. A plugin only has to ship a page it wants to
            // change; anything it does not provide falls through to the Classy default. That is
            // what keeps admin.html a single file -- it used to be copied by hand into every
            // plugin, and the copies drifted (the example plugin's was missing a term of work).
            //
            // Order matters: CopyPlugin applies patterns in sequence and "force" lets a later
            // pattern overwrite an asset an earlier one emitted, so the plugin must come second.
            //
            // The plugin's CustomStudentView / CustomAdminView are no longer copied into
            // src/app/plugs; they are resolved from the plugin directory by the "@plugs" alias
            // below. Copying them here and requiring them relatively was a build-order trap: the
            // copy happens during the run that already resolved the require.
            patterns: [
                {
                    from: "./pages",
                    to: "../" + process.env.NAME,
                    toType: "dir",
                    globOptions: {ignore: ["**/README.md"]},
                    noErrorOnMissing: false,
                    force: true
                },
                {
                    from: "../../../plugins/" + process.env.PLUGIN + "/portal/frontend/html",
                    // to: "../html/" + process.env.NAME, // puts it in ./html/{name}
                    to: "../" + process.env.NAME,
                    toType: "dir",
                    // a plugin that overrides no pages at all is legitimate, so a missing (or
                    // empty) html directory must not fail the build
                    noErrorOnMissing: true,
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
