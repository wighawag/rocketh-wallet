import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import rollupjson from 'rollup-plugin-json';
import nodebuiltin from 'rollup-plugin-node-builtins';
import pkg from './package.json';

export default [
	// browser-friendly UMD build
	{
		input: 'provider/src/HtmlProvider.js',
		output: {
			name: 'HtmlProvider',
			file: pkg.browser,
			format: 'umd'
		},
		plugins: [
            rollupjson(),
            nodebuiltin(),
            resolve({
                browser: true,
                // preferBuiltins:true
            }), 
            // commonjs(), 
            
        ]
	}
];