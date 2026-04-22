import "hardhat-gas-reporter";
import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.28",

  networks: {
    localhost: {
      url: process.env.RPC_URL || "http://127.0.0.1:8545",
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: [
        process.env.DEPLOYER_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001",
        process.env.ORACLE_1_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001",
        process.env.ORACLE_2_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001",
        process.env.ORACLE_3_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001" 
      ]
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY ?? ""
  },
  gasReporter: {
    enabled: true,
    currency: 'USD',
    excludeContracts: [],
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6"
  }
};

export default config;
