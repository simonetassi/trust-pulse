import path from "path";
import * as dotenv from "dotenv";
import { createApiServer } from "./server";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function bootApiNode() {
  process.stdout.write("Booting Indexer Node...\n");

  const apiServer = createApiServer();
  const API_PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  let isShuttingDown = false;

  process.on("SIGINT", async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log("\nShutting down API Node...");
    setTimeout(() => {
      console.warn("[Shutdown] Force exit after timeout");
      process.exit(0);
    }, 5000).unref();

    try {
      await apiServer.stop();
      console.log("Indexer Node Shutdown complete.");
    } catch (error) {
      console.error("Error during API shutdown:", error);
    } finally {
      process.exit(0);
    }
  });

  apiServer.start(API_PORT);

  console.log(`API Gateway listening on port ${API_PORT}. Press Ctrl+C to stop.`);
}

bootApiNode().catch(console.error);