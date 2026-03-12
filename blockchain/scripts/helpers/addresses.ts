import fs from "fs";
import path from "path";

const DEPLOYMENTS_FILE = path.join(__dirname, "../../../deployments.json");

type Deployments = {
  [network: string]: {
    ChainReputation?: string;
  };
};

export function saveAddress(network: string, contractName: string, address: string): void {
  let deployments: Deployments = {};

  if (fs.existsSync(DEPLOYMENTS_FILE)) {
    deployments = JSON.parse(fs.readFileSync(DEPLOYMENTS_FILE, "utf8"));
  }

  if (!deployments[network]) {
    deployments[network] = {};
  }

  deployments[network][contractName as keyof (typeof deployments)[string]] = address;
  fs.writeFileSync(DEPLOYMENTS_FILE, JSON.stringify(deployments, null, 2));
}

export function loadAddress(network: string, contractName: string): string | undefined {
  if (!fs.existsSync(DEPLOYMENTS_FILE)) return undefined;

  const deployments: Deployments = JSON.parse(
    fs.readFileSync(DEPLOYMENTS_FILE, "utf8")
  );

  return deployments[network]?.[contractName as keyof (typeof deployments)[string]];
}