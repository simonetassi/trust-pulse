import path from "path";
import { OracleManager } from "./oracle/OracleManager";
import { DeviceManager } from "./wot/DeviceManager";
import * as dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "../../.env") });

process.stdout.write("process started\n");

async function main() {
  const deviceManager = new DeviceManager();
  const oracleManager = new OracleManager();

  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    try {
      await oracleManager.stopAll();
      await deviceManager.stopAll();
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
  console.log("\nNetwork running. Press Ctrl+C to stop.");
}

main().catch(console.error);