const path = require('path');
const webpack = require('webpack');

module.exports = {
    entry: './src/index.js',
    output: {
        filename: 'naeural.js',
        path: path.resolve(__dirname, 'dist'),
        library: 'Naeural Web Client',
        libraryTarget: 'umd',
        umdNamedDefine: true,
    },
    resolve: {
        fallback: {
            "buffer": require.resolve('buffer/'),
            "assert": require.resolve("assert/"),
        }
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env'],
                    }
                }
            }
        ]
    },
    plugins: [
        // Define plugin to provide Buffer globally, since some modules might expect it to be globally available
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),
    ],
};
