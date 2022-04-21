import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import hotLoad from 'rollup-plugin-livereload';
import replace from '@rollup/plugin-replace';
import resolve from '@rollup/plugin-node-resolve';
import postcss from 'rollup-plugin-postcss';
import dts from 'rollup-plugin-dts';
import { uglify } from 'rollup-plugin-uglify';
import serve from 'rollup-plugin-serve';

const getConfigsByENV = () => {
  const dev = process.env.DEV === 'true';

  const plugins = [
    resolve({
      extensions: ['.js', '.jsx'],
      preferBuiltins: false,
    }),
    postcss(),
    babel({
      presets: dev ? [['@babel/preset-react', { runtime: 'automatic' }]] : [],
      babelHelpers: 'bundled',
      exclude: '**/node_modules/**',
      extensions: ['.js', '.jsx'],
    }),
    commonjs({
      include: /node_modules/,
    }),
  ];

  // bundle components
  const configs = [
    {
      input: dev ? 'src/playground.jsx' : 'src/index.js',
      output: {
        dir: 'dist',
        sourcemap: true,
        format: dev ? 'umd' : 'es',
        exports: dev ? 'auto' : 'named',
      },
      plugins,
      external: dev
        ? []
        : [
          'react',
          'react-dom',
          'react/jsx-runtime',
          'prop-types',
        ],
    },
  ];

  if (dev) {
    plugins.push(
      serve({
        port: 3000,
        contentBase: ['public', 'dist'],
      }),
    );
    plugins.push(
      replace({
        'process.env.NODE_ENV': JSON.stringify('development'),
        preventAssignment: true,
      }),
    );
    plugins.push(
      hotLoad({
        watch: ['public', 'dist'],
      }),
    );
  } else {
    // bundle component types
    configs.push({
      input: 'src/index.d.ts',
      output: { file: 'dist/index.d.ts' },
      plugins: [dts()],
    });

    // minify
    configs.push({
      input: 'dist/index.js',
      output: {
        file: 'dist/index.min.js',
        sourcemap: true,
      },
      plugins: [uglify()],
    });
  }

  return configs;
};

export default getConfigsByENV();
