import path from "path";
import { OracleManager } from "./oracle/OracleManager";
import { DeviceManager } from "./wot/DeviceManager";
import * as dotenv from "dotenv";
import { createApiServer } from "./api/server";
dotenv.config({ path: path.join(__dirname, "../../.env") });

process.stdout.write("process started\n");

const API_PORT = 3000;

async function main() {
  const deviceManager = new DeviceManager();
  const oracleManager = new OracleManager();
  const apiServer = createApiServer();

  let isShuttingDown = false;

  process.on("SIGINT", async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log("\nShutting down...");

    setTimeout(() => {
      console.warn("[Shutdown] Force exit after timeout");
      process.exit(0);
    }, 5000).unref();

    try {
      await oracleManager.stopAll();
      await deviceManager.stopAll();
      await apiServer.stop();
      console.log("Shutdown complete.");
    } catch (error) {
      console.error("Error during shutdown:", error);
    } finally {
      process.exit(0);
    }
  });

  await deviceManager.startAll();

  // just to be sure that all devices are exposed
  await new Promise(resolve => setTimeout(resolve, 2000));

  await oracleManager.startAll();
  apiServer.start(API_PORT);

  console.log("\nNetwork running. Press Ctrl+C to stop.");
}

main().catch(console.error);