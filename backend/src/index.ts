import { DeviceManager } from "./wot/DeviceManager";
process.stdout.write("process started\n");
async function main() {
  const manager = new DeviceManager();

  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await manager.stopAll();
    process.exit(0);
  });

  await manager.startAll();
  console.log("\nNetwork running. Press Ctrl+C to stop.");
}

main().catch(console.error);