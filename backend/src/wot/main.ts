import { DeviceManager } from "./DeviceManager";

async function bootWoTNetwork() {
  process.stdout.write("Booting up Web of Things Simulated Network...\n");
  
  const deviceManager = new DeviceManager();
  let isShuttingDown = false;

  process.on("SIGINT", async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log("\nShutting down WoT Network...");
    setTimeout(() => {
      console.warn("[Shutdown] Force exit after timeout");
      process.exit(0);
    }, 5000).unref();

    try {
      await deviceManager.stopAll();
      console.log("WoT Shutdown complete.");
    } catch (error) {
      console.error("Error during WoT shutdown:", error);
    } finally {
      process.exit(0);
    }
  });

  await deviceManager.startAll();
  console.log("\n All WoT devices are broadcasting. Press Ctrl+C to stop.");
}

bootWoTNetwork().catch(console.error);