import { defineConfig } from "vite";

export default defineConfig({
  base: "/tachyon/",
  server: {
    watch: {
      ignored: ["**/.direnv/**"],
    },
  },
});
