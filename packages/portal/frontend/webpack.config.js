var path = require('path');

module.exports = {

    // https://webpack.js.org/concepts/mode/
    mode: 'development',

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
        extensions: [".ts", ".tsx", ".js", ".json"]
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
