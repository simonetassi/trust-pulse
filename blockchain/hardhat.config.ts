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
        process.env.DEPLOYER_KEY || "",
        process.env.ORACLE_1_KEY || "",
        process.env.ORACLE_2_KEY || "",
        process.env.ORACLE_3_KEY || "" 
      ]
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY ?? ""
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6"
  }
};

export default config;
