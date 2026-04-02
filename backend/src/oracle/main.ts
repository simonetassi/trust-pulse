import path from "path";
import * as dotenv from "dotenv";
import { OracleManager } from "./OracleManager";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

async function bootOracleNode() {
  const walletAddress = process.env.ORACLE_PRIVATE_KEY ? "Loaded" : "MISSING!";
  process.stdout.write(`Booting Oracle Worker Node. Key status: ${walletAddress}\n`);

  const oracleManager = new OracleManager();
  let isShuttingDown = false;

  process.on("SIGINT", async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log("\nShutting down Oracle Node...");
    setTimeout(() => {
      console.warn("[Shutdown] Force exit after timeout");
      process.exit(0);
    }, 5000).unref();

    try {
      await oracleManager.stopAll();
      console.log("Oracle Node Shutdown complete.");
    } catch (error) {
      console.error("Error during Oracle shutdown:", error);
    } finally {
      process.exit(0);
    }
  });

  await oracleManager.startAll();

  console.log("Oracle Worker is running and actively monitoring. Press Ctrl+C to stop.");
}

bootOracleNode().catch(console.error);