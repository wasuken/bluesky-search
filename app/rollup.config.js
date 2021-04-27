import svelte from "rollup-plugin-svelte";
import resolve from "@rollup/plugin-node-resolve";
import replace from 'rollup-plugin-replace';
import dotenv from 'dotenv';
dotenv.config();

export default {
  input: "src/index.js",
  output: {
    file: "public/js/index.bundle.js",
    format: "iife",
    name: "index",
  },
  plugins: [
	replace({
      HOST: process.env.HOST
    }),
    svelte({
      include: "src/**/*.svelte",
    }),
    resolve({browser: true}),
  ],
};
