import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// A static site: the game runs entirely in the browser, with no backend.
	// (Cache Components / partial prefetching rely on a server and cannot be
	// combined with a static export.)
	output: "export",
	turbopack: {
		rules: {
			"*.css": {
				loaders: ["@tailwindcss/turbopack"],
				as: "*.css",
			},
		},
	},
};

export default nextConfig;
