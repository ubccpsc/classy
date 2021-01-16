var path = require('path');

// read the env so we can copy custom resources (if needed)
require('dotenv').config(
    {path: '../../../.env'}
);

// copy plugin files so they are available to frontend
const CopyPlugin = require('copy-webpack-plugin');

// handle @frontend and @common type import aliases from plugin
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

console.log('Preparing frontend for: ' + process.env.NAME);
console.log('Frontend plugin path: ' + process.env.PLUGIN_FULLPATH);

module.exports = {

    // https://webpack.js.org/concepts/mode/
    mode: 'development',

    plugins: [
        new CopyPlugin({
            patterns: [
                // copy plugin frontend files frontend into a place where webpack can include them
                // custom backend files can be accessed directly and do not need to be copied
                {
                    from: process.env.PLUGIN_FULLPATH + '/src/frontend/CustomStudentView.ts',
                    to: '../../src/app/custom/CustomStudentView.ts',
                    noErrorOnMissing: false
                },
                {
                    from: process.env.PLUGIN_FULLPATH + '/src/frontend/CustomAdminView.ts',
                    to: '../../src/app/custom/CustomAdminView.ts',
                    noErrorOnMissing: false
                },
                {
                    from: process.env.PLUGIN_FULLPATH + '/html',
                    // to: '../html/' + process.env.NAME, // puts it in ./html/html/{name}
                    to: '../' + process.env.NAME,
                    toType: 'dir',
                    noErrorOnMissing: false
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

    // Enable sourcemaps for debugging webpack's output.
    devtool: "source-map",

    resolve: {
        // Add '.ts' and '.tsx' as resolvable extensions.
        extensions: [".ts", ".tsx", ".js", ".json"],
        plugins: [new TsconfigPathsPlugin({
            configFile: 'tsconfig.json'
        })]
    },

    performance: {
        hints: false
    },

    module: {
        rules: [
            // All files with a '.ts' or '.tsx' extension will be handled by 'ts-loader' or awesome-typescript-loader'.
            {test: /\.tsx?$/, loader: "ts-loader"},

            // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
            {
                enforce: "pre",
                test: /\.js$/,
                loader: "source-map-loader",
                exclude: []
            }
        ]
    }
};
